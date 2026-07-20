import { PaymentDetail } from '../../payment-client';

export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <main><PaymentDetail orderId={orderId} /></main>;
}
