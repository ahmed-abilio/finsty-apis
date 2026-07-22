import PDFDocument from 'pdfkit';
import orderService from './order.service';

/** Loose shape of admin order JSON used for invoice rendering. */
interface InvoiceOrder {
  id?: string;
  orderId?: string;
  createdAt?: string | null;
  status?: string;
  deliveryType?: string;
  paymentType?: string | null;
  subtotal?: number;
  taxAmount?: number;
  platformFee?: number;
  deliveryCharge?: number;
  discountAmount?: number | null;
  couponCode?: string | null;
  walletAmountPaid?: number | null;
  totalAmount?: number;
  customer?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  address?: {
    receiverName?: string;
    receiverPhone?: string;
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  items?: Array<{
    productName?: string;
    variantLabel?: string | null;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
  }>;
}

function money(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return `INR ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function addressLines(order: InvoiceOrder): string[] {
  const a = order.address;
  if (!a) return ['No delivery address'];
  const lines: string[] = [];
  if (a.receiverName) lines.push(a.receiverName);
  if (a.receiverPhone) lines.push(a.receiverPhone);
  if (a.line1) lines.push(a.line1);
  if (a.line2) lines.push(a.line2);
  const cityLine = [a.city, a.state, a.postalCode].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  if (a.country) lines.push(a.country);
  return lines.length ? lines : ['No delivery address'];
}

export async function buildOrderInvoicePdf(orderRef: string): Promise<{
  buffer: Buffer;
  filename: string;
  orderId: string;
}> {
  const order = (await orderService.getByIdForAdmin(orderRef)) as InvoiceOrder;
  const displayId = String(order.orderId ?? order.id ?? orderRef);
  const filename = `invoice-${displayId}.pdf`;

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#111827').text('Finsty', { continued: false });
    doc.fontSize(10).fillColor('#6b7280').text('Tax Invoice / Order Receipt');
    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#e5e7eb')
      .stroke();
    doc.moveDown();

    doc.fontSize(12).fillColor('#111827').text(`Invoice for order ${displayId}`);
    doc.fontSize(10).fillColor('#374151');
    doc.text(`Placed: ${fmtDate(order.createdAt)}`);
    doc.text(`Status: ${String(order.status ?? '—').replace(/_/g, ' ')}`);
    doc.text(`Delivery: ${order.deliveryType ?? '—'}`);
    if (order.paymentType) doc.text(`Payment: ${order.paymentType}`);
    doc.moveDown();

    const customer = order.customer;
    doc.fontSize(11).fillColor('#111827').text('Bill to');
    doc.fontSize(10).fillColor('#374151');
    doc.text(customer?.name?.trim() || 'Customer');
    if (customer?.phone) doc.text(customer.phone);
    if (customer?.email) doc.text(customer.email);
    doc.moveDown();

    doc.fontSize(11).fillColor('#111827').text('Ship to');
    doc.fontSize(10).fillColor('#374151');
    for (const line of addressLines(order)) {
      doc.text(line);
    }
    doc.moveDown();

    const items = order.items ?? [];
    const colX = { name: 50, qty: 320, price: 380, total: 460 };
    doc.fontSize(10).fillColor('#111827');
    const headerY = doc.y;
    doc.text('Item', colX.name, headerY, { width: 250 });
    doc.text('Qty', colX.qty, headerY);
    doc.text('Price', colX.price, headerY);
    doc.text('Amount', colX.total, headerY);
    doc.y = headerY + 14;
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#e5e7eb')
      .stroke();
    doc.moveDown(0.8);

    doc.fillColor('#374151');
    for (const item of items) {
      const name = [item.productName, item.variantLabel].filter(Boolean).join(' — ') || 'Item';
      const y = doc.y;
      doc.text(name, colX.name, y, { width: 250 });
      const rowBottom = doc.y;
      doc.text(String(item.quantity ?? 0), colX.qty, y);
      doc.text(money(item.unitPrice), colX.price, y);
      doc.text(money(item.totalPrice), colX.total, y);
      doc.y = Math.max(rowBottom, y + 14);
      doc.moveDown(0.3);
    }

    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#e5e7eb')
      .stroke();
    doc.moveDown();

    const totals: Array<[string, string]> = [
      ['Subtotal', money(order.subtotal)],
      ['Tax', money(order.taxAmount)],
      ['Platform fee', money(order.platformFee)],
      ['Delivery', money(order.deliveryCharge)],
      ['Discount', money(order.discountAmount ?? 0)],
    ];
    if (order.couponCode) {
      totals.push(['Coupon', String(order.couponCode)]);
    }
    if (Number(order.walletAmountPaid ?? 0) > 0) {
      totals.push(['Wallet paid', money(order.walletAmountPaid)]);
    }
    totals.push(['Total', money(order.totalAmount)]);

    for (const [label, value] of totals) {
      const y = doc.y;
      const isTotal = label === 'Total';
      doc.fontSize(isTotal ? 11 : 10).fillColor(isTotal ? '#111827' : '#374151');
      doc.text(label, 350, y);
      doc.text(value, 430, y, { width: 115, align: 'right' });
      doc.moveDown(0.4);
    }

    doc.moveDown();
    doc.fontSize(9).fillColor('#9ca3af').text('Generated by Finsty Admin', 50, doc.y);
    doc.text(`Generated at ${fmtDate(new Date().toISOString())}`);

    doc.end();
  });

  return { buffer, filename, orderId: displayId };
}
