from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from docx import Document
from docx.document import Document as DocumentType
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph as DocxParagraph
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(r"C:\personal\daw")
DOCX = ROOT / "docs" / "Magic_Pro_Architecture_Report.docx"
PDF = ROOT / "docs" / "Magic_Pro_Architecture_Report.pdf"


def iter_block_items(parent: DocumentType):
    body = parent.element.body
    for child in body.iterchildren():
        if isinstance(child, CT_P):
            yield DocxParagraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield DocxTable(child, parent)


def paragraph_has_page_break(paragraph: DocxParagraph) -> bool:
    return bool(paragraph._p.xpath(".//w:br[@w:type='page']"))


def paragraph_text(paragraph: DocxParagraph) -> str:
    parts: list[str] = []
    for run in paragraph.runs:
        text = run.text or ""
        if not text:
            continue
        safe = escape(text).replace("\n", "<br/>")
        if run.bold:
            safe = f"<b>{safe}</b>"
        if run.italic:
            safe = f"<i>{safe}</i>"
        parts.append(safe)
    return "".join(parts).strip()


def cell_text(cell) -> str:
    chunks = []
    for paragraph in cell.paragraphs:
        text = paragraph_text(paragraph)
        if text:
            chunks.append(text)
    return "<br/>".join(chunks)


def build_styles():
    base = getSampleStyleSheet()
    styles = {
        "Title": ParagraphStyle(
            "MagicTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=29,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#1F4E79"),
            spaceAfter=12,
        ),
        "Subtitle": ParagraphStyle(
            "MagicSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#595959"),
            spaceAfter=14,
        ),
        "Normal": ParagraphStyle(
            "MagicNormal",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.7,
            leading=11.5,
            spaceAfter=5,
            alignment=TA_LEFT,
        ),
        "Heading 1": ParagraphStyle(
            "MagicH1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=17,
            textColor=colors.HexColor("#2E74B5"),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "Heading 2": ParagraphStyle(
            "MagicH2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=14,
            textColor=colors.HexColor("#2E74B5"),
            spaceBefore=7,
            spaceAfter=4,
        ),
        "Heading 3": ParagraphStyle(
            "MagicH3",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#1F4E79"),
            spaceBefore=6,
            spaceAfter=3,
        ),
        "CodeBlock": ParagraphStyle(
            "MagicCode",
            parent=base["Code"],
            fontName="Courier",
            fontSize=7,
            leading=9,
            leftIndent=0.08 * inch,
            backColor=colors.HexColor("#F6F8FA"),
            borderColor=colors.HexColor("#D0D7DE"),
            borderWidth=0.25,
            borderPadding=3,
            spaceAfter=4,
        ),
        "Bullet": ParagraphStyle(
            "MagicBullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            leftIndent=12,
            firstLineIndent=-7,
            spaceAfter=3,
        ),
        "Number": ParagraphStyle(
            "MagicNumber",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            leftIndent=14,
            firstLineIndent=-9,
            spaceAfter=3,
        ),
        "Cell": ParagraphStyle(
            "MagicCell",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.2,
            leading=8.8,
            spaceAfter=0,
        ),
        "CellHeader": ParagraphStyle(
            "MagicCellHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            textColor=colors.HexColor("#1F4E79"),
            spaceAfter=0,
        ),
    }
    return styles


def table_flowable(block: DocxTable, styles, page_width: float):
    data = []
    for row_index, row in enumerate(block.rows):
        out_row = []
        for cell in row.cells:
            text = cell_text(cell) or " "
            style = styles["CellHeader"] if row_index == 0 else styles["Cell"]
            out_row.append(Paragraph(text, style))
        data.append(out_row)

    if not data:
        return Spacer(1, 0)

    column_count = len(data[0])
    col_width = page_width / column_count
    tbl = Table(data, colWidths=[col_width] * column_count, repeatRows=1, splitByRow=1)
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2F4F7")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#BFBFBF")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return KeepTogether([tbl, Spacer(1, 7)])


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = landscape(letter)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#595959"))
    canvas.drawString(doc.leftMargin, height - 0.35 * inch, "Magic Pro Architecture Report")
    canvas.drawRightString(width - doc.rightMargin, 0.3 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf() -> Path:
    styles = build_styles()
    page_size = landscape(letter)
    left = right = 0.45 * inch
    top = bottom = 0.5 * inch
    page_width = page_size[0] - left - right
    doc = SimpleDocTemplate(
        str(PDF),
        pagesize=page_size,
        rightMargin=right,
        leftMargin=left,
        topMargin=top,
        bottomMargin=bottom,
        title="Magic Pro Architecture Report",
        author="Codex",
        subject="Browser DAW project architecture",
    )

    source = Document(DOCX)
    story = []
    list_counter = 1

    for block in iter_block_items(source):
        if isinstance(block, DocxParagraph):
            style_name = block.style.name if block.style else "Normal"
            text = paragraph_text(block)
            if paragraph_has_page_break(block):
                if story and not isinstance(story[-1], PageBreak):
                    story.append(PageBreak())
                continue
            if not text:
                story.append(Spacer(1, 3))
                continue
            if style_name == "List Bullet":
                story.append(Paragraph(f"&bull; {text}", styles["Bullet"]))
                continue
            if style_name == "List Number":
                story.append(Paragraph(f"{list_counter}. {text}", styles["Number"]))
                list_counter += 1
                continue
            list_counter = 1
            mapped = styles.get(style_name, styles["Normal"])
            story.append(Paragraph(text, mapped))
        elif isinstance(block, DocxTable):
            list_counter = 1
            story.append(table_flowable(block, styles, page_width))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    return PDF


if __name__ == "__main__":
    print(build_pdf())
