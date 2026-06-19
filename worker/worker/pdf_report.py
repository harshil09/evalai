import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from worker.charts import role_share_chart, tokens_by_turn_chart, user_evaluation_bar_chart
from worker.cost_analysis import format_usd


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
    )
    heading_style = styles["Heading2"]
    body_style = styles["BodyText"]

    story: list = []
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    story.append(Paragraph("Transcript Token Analysis Report", title_style))
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
    summary_table = Table(summary_rows, colWidths=[2.5 * inch, 3.5 * inch])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f5")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 0.3 * inch))

    user_eval = summary.get("user_evaluation") or {}
    if user_eval:
        story.append(Paragraph("AI tool usage evaluation", heading_style))
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

        eval_chart = user_evaluation_bar_chart(user_eval.get("dimensions", []))
        chart_height = min(7.2, max(4.5, len(user_eval.get("dimensions", [])) * 0.38))
        story.append(Image(io.BytesIO(eval_chart), width=6.5 * inch, height=chart_height * inch))
        story.append(Spacer(1, 0.15 * inch))

        dimension_rows = [["Skill", "Score", "Assessment"]]
        for dim in user_eval.get("dimensions", []):
            dimension_rows.append(
                [dim["label"], f"{dim['score']}%", dim.get("detail", "")]
            )
        dimension_table = Table(
            dimension_rows,
            colWidths=[1.75 * inch, 0.65 * inch, 3.7 * inch],
        )
        dimension_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f5")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(dimension_table)

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
            if cost_cmp.get("user_reported_model"):
                story.append(
                    Paragraph(
                        f"Model reported at upload: <b>{cost_cmp['user_reported_model']}</b>",
                        body_style,
                    )
                )
            if cost_cmp.get("detected_model"):
                story.append(
                    Paragraph(
                        f"Model mentioned in chat: <b>{cost_cmp['detected_model']}</b>",
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
            summary_cost_table = Table(summary_cost_rows, colWidths=[2.2 * inch, 3.8 * inch])
            summary_cost_table.setStyle(
                TableStyle(
                    [
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#fafafa")),
                    ]
                )
            )
            story.append(summary_cost_table)
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
            market_table = Table(
                market_rows,
                colWidths=[1.35 * inch, 0.85 * inch, 0.45 * inch, 0.55 * inch, 0.95 * inch, 0.75 * inch],
            )
            market_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f5")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 7),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                    ]
                )
            )
            story.append(market_table)
            if cost_cmp.get("note"):
                story.append(Spacer(1, 0.08 * inch))
                story.append(Paragraph(f"<i>{cost_cmp['note']}</i>", body_style))

        insights = user_eval.get("insights") or []
        if insights:
            story.append(Spacer(1, 0.12 * inch))
            story.append(Paragraph("Recommendations", heading_style))
            for insight in insights:
                story.append(Paragraph(f"• {insight}", body_style))

        story.append(Spacer(1, 0.1 * inch))
        story.append(
            Paragraph(
                f"<i>{user_eval.get('methodology', '')}</i>",
                body_style,
            )
        )
        story.append(Spacer(1, 0.25 * inch))

    turn_chart = tokens_by_turn_chart(summary.get("tokens_by_turn", []))
    role_chart = role_share_chart(
        summary.get("user_tokens", 0),
        summary.get("agent_tokens", 0),
    )
    story.append(Paragraph("Charts", heading_style))
    story.append(Image(io.BytesIO(turn_chart), width=6.5 * inch, height=3.2 * inch))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Image(io.BytesIO(role_chart), width=3.5 * inch, height=3.5 * inch))
    story.append(Spacer(1, 0.3 * inch))

    story.append(Paragraph("Model fit analysis", heading_style))
    story.append(
        Paragraph(
            "Based on total input tokens with "
            f"{summary.get('reserved_output_tokens', 4096)} tokens reserved for response. "
            "This is a context-window fit check, not a quality evaluation.",
            body_style,
        )
    )
    story.append(Spacer(1, 0.1 * inch))

    model_rows = [["Model", "Provider", "Fits", "Tokens", "Input cost", "Est. (USD)"]]
    for model in summary.get("model_recommendations", []):
        cost = float(model.get("est_input_cost_usd", 0))
        model_rows.append(
            [
                model["model_id"],
                model["provider"],
                "Yes" if model["fits"] else "No",
                str(model["total_tokens"]),
                format_usd(cost),
                f"{cost:.8f}",
            ]
        )
    model_table = Table(
        model_rows,
        colWidths=[1.2 * inch, 0.9 * inch, 0.5 * inch, 0.65 * inch, 0.95 * inch, 1.0 * inch],
    )
    model_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f5")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ]
        )
    )
    story.append(model_table)

    warnings = summary.get("parse_warnings") or []
    if warnings:
        story.append(Spacer(1, 0.25 * inch))
        story.append(Paragraph("Parse notes", heading_style))
        for warning in warnings:
            story.append(Paragraph(f"• {warning}", body_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()
