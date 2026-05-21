import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

type CsvCell = string | number | boolean | Date | null | undefined | object;

function csvEscape(value: CsvCell) {
  if (value == null) {
    return '';
  }

  const text = value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: CsvCell[][]) {
  return [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}

async function buildCsv(kind: string) {
  if (kind === 'reports') {
    const reports = await db.contentReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: { reporter: { select: { email: true, username: true } } }
    });
    return toCsv(
      ['id', 'status', 'targetType', 'targetId', 'reason', 'details', 'reporter', 'createdAt'],
      reports.map((report) => [
        report.id,
        report.status,
        report.targetType,
        report.targetId,
        report.reason,
        report.details,
        report.reporter?.email ?? report.reporter?.username,
        report.createdAt
      ])
    );
  }

  if (kind === 'verifications') {
    const profiles = await db.profile.findMany({
      where: { verificationStatus: { in: ['PENDING', 'VERIFIED', 'REJECTED'] } },
      orderBy: { verificationSubmittedAt: 'desc' },
      take: 1000,
      select: {
        id: true,
        name: true,
        type: true,
        contactInfo: true,
        verified: true,
        verificationStatus: true,
        verificationNotes: true,
        verificationSubmittedAt: true,
        verificationReviewedAt: true
      }
    });
    return toCsv(
      ['id', 'name', 'type', 'contactInfo', 'verified', 'status', 'notes', 'submittedAt', 'reviewedAt'],
      profiles.map((profile) => [
        profile.id,
        profile.name,
        profile.type,
        profile.contactInfo,
        profile.verified,
        profile.verificationStatus,
        profile.verificationNotes,
        profile.verificationSubmittedAt,
        profile.verificationReviewedAt
      ])
    );
  }

  if (kind === 'tickets') {
    const orders = await db.ticketOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: { show: { select: { title: true, slug: true } } }
    });
    return toCsv(
      ['id', 'confirmationCode', 'status', 'show', 'buyerEmail', 'quantity', 'subtotalCents', 'taxCents', 'totalChargeCents', 'createdAt', 'chargedAt'],
      orders.map((order) => [
        order.id,
        order.confirmationCode,
        order.status,
        order.show.title,
        order.buyerEmail,
        order.quantity,
        order.subtotalCents,
        order.totalTaxCents,
        order.totalChargeCents,
        order.createdAt,
        order.chargedAt
      ])
    );
  }

  if (kind === 'audits') {
    const audits = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: { actor: { select: { email: true, username: true } } }
    });
    return toCsv(
      ['id', 'action', 'entityType', 'entityId', 'actor', 'ipAddress', 'metadata', 'createdAt'],
      audits.map((audit) => [
        audit.id,
        audit.action,
        audit.entityType,
        audit.entityId,
        audit.actor?.email ?? audit.actor?.username,
        audit.ipAddress,
        audit.metadata,
        audit.createdAt
      ])
    );
  }

  if (kind === 'support') {
    const requests = await db.supportRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000
    });
    return toCsv(
      ['id', 'status', 'priority', 'type', 'name', 'email', 'subject', 'details', 'requesterUserId', 'createdAt'],
      requests.map((request) => [
        request.id,
        request.status,
        request.priority,
        request.type,
        request.name,
        request.email,
        request.subject,
        request.details,
        request.requesterUserId,
        request.createdAt
      ])
    );
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> }
) {
  const session = await auth();

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { kind } = await params;
  const csv = await buildCsv(kind);

  if (!csv) {
    return NextResponse.json({ error: 'Unknown export type' }, { status: 404 });
  }

  const rowCount = csv.split('\n').length - 1; // exclude header
  const truncated = rowCount >= 1000;

  return new NextResponse(csv, {
    headers: {
      ...(truncated ? { 'X-Export-Truncated': 'true', 'X-Export-Row-Limit': '1000' } : {}),
      'Content-Disposition': `attachment; filename="ihype-${kind}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8'
    }
  });
}
