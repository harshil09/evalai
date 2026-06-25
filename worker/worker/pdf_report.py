import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from worker.charts import (
    nightingale_chart,
    role_share_chart,
    tokens_by_turn_chart,
)
from worker.cost_analysis import format_usd
from worker.version import REPORT_TITLE



PDF_BODY_FONT_SIZE = 10
PDF_BODY_LEADING = 14
PDF_CELL_FONT_SIZE = 7.5
PDF_CELL_LEADING = 10.5


def _pdf_body_style(parent: ParagraphStyle) -> ParagraphStyle:
    return ParagraphStyle(
        "ReportBody",
        parent=parent,
        fontName="Helvetica",
        fontSize=PDF_BODY_FONT_SIZE,
        leading=PDF_BODY_LEADING,
        textColor=colors.HexColor("#111827"),
    )


def _pdf_cell_style(parent: ParagraphStyle) -> ParagraphStyle:
    return ParagraphStyle(
        "ReportCell",
        parent=parent,
        fontName="Helvetica",
        fontSize=PDF_CELL_FONT_SIZE,
        leading=PDF_CELL_LEADING,
        textColor=colors.HexColor("#1f2937"),
    )


def _escape_pdf_text(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _cell_para(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(_escape_pdf_text(str(text or "")), style)


def _table_style(header: bool = True) -> TableStyle:
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        commands.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f5")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
            ]
        )
    commands.extend([
        ("FONTSIZE", (0, 1), (-1, -1), PDF_CELL_FONT_SIZE),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#1f2937")),
    ])
    return TableStyle(commands)


def _para_table(
    rows: list[list],
    col_widths: list,
    cell_style: ParagraphStyle,
    *,
    header: bool = True,
) -> Table:
    table_rows: list[list] = []
    for row_idx, row in enumerate(rows):
        if row_idx == 0 and header:
            table_rows.append([str(cell) for cell in row])
        else:
            table_rows.append([_cell_para(cell, cell_style) for cell in row])
    table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(_table_style(header=header))
    return table


def _coaching_payload(summary: dict) -> dict:
    coaching = summary.get("prompting_recommendations")
    if coaching:
        return coaching
    return {}


def _format_model_cell(
    model_id: str | None,
    cost_label: str | None,
    source: str | None = None,
) -> str:
    if not model_id:
        return "—"
    parts = [model_id]
    if cost_label:
        parts.append(f"est. {cost_label}")
    if source:
        parts.append(f"({source})")
    return " — ".join(parts)


def _append_prompting_recommendations(story: list, summary: dict, body_style, heading_style) -> None:
    coaching = _coaching_payload(summary)
    if not coaching:
        return

    cell_style = _pdf_cell_style(body_style)
    subheading_style = ParagraphStyle(
        "PromptingSubheading",
        parent=heading_style,
        fontSize=12,
        spaceBefore=10,
        spaceAfter=6,
    )

    story.append(Paragraph("Prompting recommendations", heading_style))

    efficiency = coaching.get("prompt_efficiency") or {}
    if not efficiency and coaching.get("summary"):
        story.append(Paragraph(_escape_pdf_text(coaching["summary"]), body_style))

    focus = coaching.get("focus_dimension")
    focus_score = coaching.get("focus_dimension_score")
    if focus is not None and focus_score is not None:
        story.append(
            Paragraph(
                f"<b>Priority skill area:</b> {focus} ({focus_score}%)",
                body_style,
            )
        )

    if efficiency:
        eff_rows = [
            ["Metric", "Value"],
            ["Efficiency score", f"{efficiency.get('efficiency_score', 0)}%"],
            ["Grade", efficiency.get("grade", "—")],
            ["Prompt quality", f"{efficiency.get('prompting_quality_score', 0)}%"],
        ]
        eff_table = _para_table(eff_rows, [2.5 * inch, 3.5 * inch], cell_style)
        story.append(Spacer(1, 0.08 * inch))
        story.append(KeepTogether([eff_table]))

    clusters = coaching.get("redundancy_clusters") or []
    techniques = coaching.get("prompting_techniques") or []
    if clusters or techniques:
        story.append(Paragraph("Coaching insights", subheading_style))
        if clusters:
            cluster_rows = [["Cluster", "Turns", "Size"]]
            for cluster in clusters:
                cluster_rows.append(
                    [
                        str(cluster.get("cluster_id", "")),
                        ", ".join(str(t) for t in cluster.get("turn_indices", [])),
                        str(cluster.get("size", 0)),
                    ]
                )
            story.append(
                KeepTogether(
                    [
                        Paragraph("<b>Redundant prompt clusters</b>", body_style),
                        _para_table(
                            cluster_rows,
                            [0.8 * inch, 3.5 * inch, 0.7 * inch],
                            cell_style,
                        ),
                    ]
                )
            )
            story.append(Spacer(1, 0.08 * inch))
        if techniques:
            story.append(Paragraph("<b>Prompting techniques to try</b>", body_style))
            for tech in techniques:
                story.append(Paragraph(f"• {_escape_pdf_text(tech)}", body_style))

    story.append(Spacer(1, 0.25 * inch))


def _append_task_aware_model_advice(story: list, summary: dict, body_style, heading_style) -> None:
    coaching = _coaching_payload(summary)
    if not coaching:
        return

    cell_style = _pdf_cell_style(body_style)
    subheading_style = ParagraphStyle(
        "PromptingSubheading",
        parent=heading_style,
        fontSize=12,
        spaceBefore=10,
        spaceAfter=6,
    )

    model_advice = coaching.get("model_advice") or {}
    if not model_advice:
        return

    story.append(Paragraph("Task-aware model advice", subheading_style))
    if model_advice.get("rationale"):
        story.append(
            Paragraph(_escape_pdf_text(model_advice["rationale"]), body_style)
        )
    story.append(Spacer(1, 0.06 * inch))

    tier_label = model_advice.get("task_tier_label") or model_advice.get("task_tier", "—")
    tier_score = model_advice.get("task_complexity_score", 0)
    advice_rows = [
        ["Field", "Recommendation"],
        ["Task complexity", f"{tier_label} ({tier_score}%)"],
        [
            "Recommended model for this task tier",
            _format_model_cell(
                model_advice.get("tier_recommended_model"),
                model_advice.get("tier_recommended_cost_label"),
            ),
        ],
        [
            "Reference model",
            _format_model_cell(
                model_advice.get("reference_model"),
                model_advice.get("reference_cost_label"),
                model_advice.get("reference_source"),
            ),
        ],
        [
            "Cheapest context fit",
            _format_model_cell(
                model_advice.get("cost_fit_recommended_model"),
                model_advice.get("cost_fit_cost_label"),
            ),
        ],
    ]
    if model_advice.get("tier_vs_reference_savings_percent") is not None:
        advice_rows.append(
            [
                "Task-tier savings vs reference",
                (
                    f"{model_advice['tier_vs_reference_savings_percent']}% "
                    f"({model_advice.get('tier_vs_reference_savings_label', '—')})"
                ),
            ]
        )

    story.append(
        KeepTogether(
            [_para_table(advice_rows, [2.2 * inch, 3.8 * inch], cell_style)]
        )
    )
    if model_advice.get("note"):
        story.append(Spacer(1, 0.06 * inch))
        story.append(
            Paragraph(f"<i>{_escape_pdf_text(model_advice['note'])}</i>", body_style)
        )

    story.append(Spacer(1, 0.25 * inch))


def build_pdf_report(
    *,
    title: str,
    filename: str,
    summary: dict,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=20,
        spaceAfter=12,
        textColor=colors.HexColor("#1f2937"),
    )
    heading_style = ParagraphStyle(
        "ReportHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#111827"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = _pdf_body_style(styles["BodyText"])
    cell_style = _pdf_cell_style(body_style)

    story: list = []
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    story.append(Paragraph(REPORT_TITLE, title_style))
    story.append(Paragraph(f"<b>File:</b> {filename or title or 'Untitled'}", body_style))
    story.append(Paragraph(f"<b>Generated:</b> {generated_at}", body_style))
    story.append(Spacer(1, 0.25 * inch))

    story.append(Paragraph("Summary", heading_style))
    summary_rows = [
        ["Metric", "Value"],
        ["Total tokens", str(summary.get("total_tokens", 0))],
        ["User tokens", str(summary.get("user_tokens", 0))],
        ["Agent tokens", str(summary.get("agent_tokens", 0))],
        ["Turn count", str(summary.get("turn_count", 0))],
        ["Avg tokens / turn", str(summary.get("avg_tokens_per_turn", 0))],
        ["Max turn tokens", str(summary.get("max_turn_tokens", 0))],
        ["Encoding", summary.get("encoding_used", "cl100k_base")],
        ["Best fit model", summary.get("best_fit_model") or "None (exceeds all windows)"],
    ]
    story.append(
        KeepTogether(
            [_para_table(summary_rows, [2.5 * inch, 3.5 * inch], cell_style)]
        )
    )
    story.append(Spacer(1, 0.3 * inch))

    user_eval = summary.get("user_evaluation") or {}
    if user_eval:
        story.append(Paragraph("How efficiently the user uses AI tools", heading_style))
        overall = user_eval.get("overall_score", 0)
        grade = user_eval.get("grade", "—")
        story.append(
            Paragraph(
                f"<b>Overall AI usage score:</b> {overall}% &nbsp;&nbsp; "
                f"<b>Rating:</b> {grade}",
                body_style,
            )
        )
        if user_eval.get("written_summary"):
            story.append(Paragraph(user_eval["written_summary"], body_style))
        story.append(Spacer(1, 0.1 * inch))

        dimensions = user_eval.get("dimensions", [])
        dimension_rows = [["Skill", "Score", "Description", "Assessment"]]
        for dim in dimensions:
            dimension_rows.append(
                [
                    dim["label"],
                    f"{dim['score']}%",
                    dim.get("description", ""),
                    dim.get("detail", ""),
                ]
            )
        story.append(
            KeepTogether(
                [
                    _para_table(
                        dimension_rows,
                        [1.35 * inch, 0.55 * inch, 1.85 * inch, 2.0 * inch],
                        cell_style,
                    )
                ]
            )
        )

        cost_cmp = user_eval.get("cost_comparison") or summary.get("cost_analysis") or {}
        if cost_cmp and cost_cmp.get("reference_model"):
            story.append(Spacer(1, 0.15 * inch))
            story.append(Paragraph("Cost optimization comparison", heading_style))
            story.append(
                Paragraph(
                    f"Based on <b>{cost_cmp.get('session_tokens', 0)} tokens</b> in this transcript. "
                    f"Reference model: <b>{cost_cmp.get('reference_model')}</b> "
                    f"({cost_cmp.get('reference_source', 'reference')}).",
                    body_style,
                )
            )
            story.append(Spacer(1, 0.08 * inch))

            summary_cost_rows = [
                ["Reference model", cost_cmp.get("reference_model", "—")],
                ["Est. input cost (reference)", cost_cmp.get("reference_cost_label", "—")],
                ["Recommended model", cost_cmp.get("recommended_model", "—")],
                ["Est. input cost (recommended)", cost_cmp.get("recommended_cost_label", "—")],
                [
                    "Potential savings vs reference",
                    f"{cost_cmp.get('savings_percent', 0)}% ({cost_cmp.get('savings_label', '$0')})",
                ],
            ]
            story.append(
                KeepTogether(
                    [
                        _para_table(
                            summary_cost_rows,
                            [2.2 * inch, 3.8 * inch],
                            cell_style,
                            header=False,
                        )
                    ]
                )
            )
            story.append(Spacer(1, 0.12 * inch))

            story.append(Paragraph("All models — cost for this transcript", heading_style))
            market_rows = [
                [
                    "Model",
                    "Provider",
                    "Fits",
                    "Tokens",
                    "Input cost",
                    "Savings vs ref.",
                ]
            ]
            for row in cost_cmp.get("model_comparisons", []):
                tag = ""
                if row.get("is_reference"):
                    tag = " (reference)"
                elif row.get("is_recommended"):
                    tag = " (recommended)"
                market_rows.append(
                    [
                        row["model_id"] + tag,
                        row["provider"],
                        "Yes" if row["fits"] else "No",
                        str(row["total_tokens"]),
                        row.get("est_input_cost_label", format_usd(row["est_input_cost_usd"])),
                        f"{row['savings_vs_reference_percent']}%",
                    ]
                )
            story.append(
                KeepTogether(
                    [
                        _para_table(
                            market_rows,
                            [1.2 * inch, 0.75 * inch, 0.4 * inch, 0.5 * inch, 0.85 * inch, 0.7 * inch],
                            cell_style,
                        )
                    ]
                )
            )
            if cost_cmp.get("note"):
                story.append(Spacer(1, 0.08 * inch))
                story.append(Paragraph(f"<i>{cost_cmp['note']}</i>", body_style))

        story.append(Spacer(1, 0.25 * inch))

    if user_eval:
        dimensions = user_eval.get("dimensions", [])
        nightingale = nightingale_chart(dimensions, title="Skill scores")
        story.append(
            Image(io.BytesIO(nightingale), width=5.0 * inch, height=5.0 * inch)
        )
        story.append(Spacer(1, 0.12 * inch))

    turn_chart = tokens_by_turn_chart(summary.get("tokens_by_turn", []))
    role_chart = role_share_chart(
        summary.get("user_tokens", 0),
        summary.get("agent_tokens", 0),
    )
    story.append(Paragraph("Tokens Analysis", heading_style))
    story.append(
        Paragraph(
            "The bar chart shows token usage for each conversation turn in this transcript "
            "(user turns vs agent turns). The pie chart shows how total tokens are split "
            f"between your messages ({summary.get('user_tokens', 0):,} tokens) and AI responses "
            f"({summary.get('agent_tokens', 0):,} tokens).",
            body_style,
        )
    )
    story.append(Spacer(1, 0.1 * inch))
    story.append(Image(io.BytesIO(turn_chart), width=6.5 * inch, height=3.2 * inch))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Image(io.BytesIO(role_chart), width=3.5 * inch, height=3.5 * inch))
    story.append(Spacer(1, 0.3 * inch))

    story.append(Paragraph("Model fit analysis", heading_style))
    story.append(
        Paragraph(
            "Based on total input tokens with "
            f"{summary.get('reserved_output_tokens', 4096)} tokens reserved for response. "
            "The comparison column explains cost and capability vs the transcript reference model.",
            body_style,
        )
    )
    story.append(Spacer(1, 0.1 * inch))

    model_rows = [
        ["Model", "Provider", "Fits", "Tokens", "Input cost", "vs reference model"]
    ]
    for model in summary.get("model_recommendations", []):
        cost = float(model.get("est_input_cost_usd", 0))
        model_rows.append(
            [
                model["model_id"],
                model["provider"],
                "Yes" if model["fits"] else "No",
                str(model["total_tokens"]),
                format_usd(cost),
                model.get("comparison_note", "—"),
            ]
        )
    story.append(
        KeepTogether(
            [
                _para_table(
                    model_rows,
                    [1.0 * inch, 0.7 * inch, 0.4 * inch, 0.55 * inch, 0.75 * inch, 2.35 * inch],
                    cell_style,
                )
            ]
        )
    )

    _append_prompting_recommendations(story, summary, body_style, heading_style)
    _append_task_aware_model_advice(story, summary, body_style, heading_style)

    doc.build(story)
    buffer.seek(0)
    return buffer.read()
