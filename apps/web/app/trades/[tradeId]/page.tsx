import { TradeDetail } from '../../trade-client';

export default async function TradePage({ params }: { params: Promise<{ tradeId: string }> }) {
  const { tradeId } = await params;
  return <main><TradeDetail id={tradeId} /></main>;
}
