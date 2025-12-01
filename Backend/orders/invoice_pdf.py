"""
Invoice PDF Generation Module

This module generates professional PDF invoices using ReportLab.
"""
import io
from decimal import Decimal
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT


def generate_invoice_pdf(order, invoice):
    """
    Generate a PDF invoice for an order.
    
    Args:
        order: Order model instance
        invoice: Invoice model instance
    
    Returns:
        io.BytesIO: PDF file buffer
    """
    # Create a file-like buffer to receive PDF data
    buffer = io.BytesIO()
    
    # Create the PDF object using ReportLab
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18,
    )
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Define styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a73e8'),
        spaceAfter=12,
        alignment=TA_CENTER,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=12,
    )
    
    normal_style = styles['Normal']
    
    # Title
    title = Paragraph("INVOICE", title_style)
    elements.append(title)
    elements.append(Spacer(1, 0.2*inch))
    
    # Company Info (Header)
    company_info = [
        ["CS308 E-Commerce", ""],
        ["Online Shopping Platform", ""],
        ["Istanbul, Turkey", ""],
    ]
    
    # Invoice details in header
    invoice_date = invoice.issue_date.strftime("%B %d, %Y") if invoice.issue_date else "N/A"
    invoice_info = [
        ["", f"<b>Invoice #:</b> {invoice.invoice_number}"],
        ["", f"<b>Date:</b> {invoice_date}"],
        ["", f"<b>Order ID:</b> {order.id}"],
    ]
    
    # Combine company and invoice info
    header_data = []
    for i in range(max(len(company_info), len(invoice_info))):
        left = company_info[i][0] if i < len(company_info) else ""
        right = invoice_info[i][1] if i < len(invoice_info) else ""
        header_data.append([left, right])
    
    header_table = Table(header_data, colWidths=[3.5*inch, 3*inch])
    header_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#555555')),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Customer Information
    customer_heading = Paragraph("Bill To:", heading_style)
    elements.append(customer_heading)
    
    customer_name = order.customer.get_full_name() if hasattr(order.customer, 'get_full_name') else str(order.customer)
    customer_email = order.customer.email if hasattr(order.customer, 'email') else "N/A"
    
    customer_data = [
        [f"<b>{customer_name}</b>"],
        [customer_email],
        [order.delivery_address],
    ]
    
    customer_table = Table(customer_data, colWidths=[6.5*inch])
    customer_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#333333')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(customer_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Order Items Table
    items_heading = Paragraph("Order Items:", heading_style)
    elements.append(items_heading)
    
    # Table header
    items_data = [['Item', 'Quantity', 'Unit Price', 'Total']]
    
    # Add order items
    for item in order.items.all():
        product_name = item.product.name if hasattr(item.product, 'name') else f"Product #{item.product.id}"
        items_data.append([
            product_name,
            str(item.quantity),
            f"₺{float(item.unit_price):.2f}",
            f"₺{float(item.line_total):.2f}"
        ])
    
    # Create the table
    items_table = Table(items_data, colWidths=[3*inch, 1*inch, 1.25*inch, 1.25*inch])
    items_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a73e8')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Summary (Subtotal, Tax, Total)
    summary_data = [
        ['Subtotal:', f"₺{float(order.subtotal):.2f}"],
        ['Tax (18%):', f"₺{float(order.tax_amount):.2f}"],
        ['', ''],  # Spacer row
        ['<b>Total:</b>', f"<b>₺{float(order.total_amount):.2f}</b>"],
    ]
    
    summary_table = Table(summary_data, colWidths=[5*inch, 1.5*inch])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 2), 'Helvetica'),
        ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (-1, 2), colors.HexColor('#555555')),
        ('TEXTCOLOR', (0, 3), (-1, 3), colors.HexColor('#1a73e8')),
        ('LINEABOVE', (0, 3), (-1, 3), 2, colors.HexColor('#1a73e8')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 0.4*inch))
    
    # Payment Information
    payment_heading = Paragraph("Payment Information:", heading_style)
    elements.append(payment_heading)
    
    payment_status_color = '#4caf50' if order.payment_status == 'APPROVED' else '#ff9800'
    payment_data = [
        ['Payment Status:', f'<font color="{payment_status_color}"><b>{order.payment_status}</b></font>'],
        ['Transaction ID:', order.transaction_id or 'N/A'],
        ['Card:', f"•••• •••• •••• {order.card_last_four}" if order.card_last_four else 'N/A'],
        ['Order Status:', order.status],
    ]
    
    payment_table = Table(payment_data, colWidths=[2*inch, 4.5*inch])
    payment_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#333333')),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(payment_table)
    elements.append(Spacer(1, 0.5*inch))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#888888'),
        alignment=TA_CENTER,
    )
    footer = Paragraph(
        "Thank you for your business!<br/>For questions about this invoice, please contact support@cs308shop.com",
        footer_style
    )
    elements.append(footer)
    
    # Build PDF
    doc.build(elements)
    
    # Get the value of the BytesIO buffer and return it
    pdf = buffer.getvalue()
    buffer.close()
    return pdf

