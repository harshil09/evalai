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

from worker.charts import role_share_chart, tokens_by_turn_chart


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

    model_rows = [["Model", "Provider", "Fits", "Total tokens", "Headroom", "Est. cost (USD)"]]
    for model in summary.get("model_recommendations", [])[:8]:
        model_rows.append(
            [
                model["model_id"],
                model["provider"],
                "Yes" if model["fits"] else "No",
                str(model["total_tokens"]),
                str(model["headroom_tokens"]),
                f"${model['est_input_cost_usd']:.4f}",
            ]
        )
    model_table = Table(
        model_rows,
        colWidths=[1.3 * inch, 1.0 * inch, 0.6 * inch, 1.0 * inch, 0.9 * inch, 1.0 * inch],
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
