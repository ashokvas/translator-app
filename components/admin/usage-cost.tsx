'use client';

import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { format } from 'date-fns';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

type UsageEvent = {
  provider: string;
  kind: 'text' | 'vision' | 'ocr';
  model?: string;
  inputChars?: number;
  outputChars?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  requests?: number;
  createdAt: number;
  fileName: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  'google-translate': 'Google Translate',
  'google-vision': 'Google Vision',
};

const COST_RATES = {
  openrouter: {
    promptPerMToken: Number(process.env.NEXT_PUBLIC_OPENROUTER_PROMPT_PER_M_TOKEN || 0),
    completionPerMToken: Number(process.env.NEXT_PUBLIC_OPENROUTER_COMPLETION_PER_M_TOKEN || 0),
  },
  openai: {
    promptPerMToken: Number(process.env.NEXT_PUBLIC_OPENAI_PROMPT_PER_M_TOKEN || 0),
    completionPerMToken: Number(process.env.NEXT_PUBLIC_OPENAI_COMPLETION_PER_M_TOKEN || 0),
  },
  anthropic: {
    promptPerMToken: Number(process.env.NEXT_PUBLIC_ANTHROPIC_PROMPT_PER_M_TOKEN || 0),
    completionPerMToken: Number(process.env.NEXT_PUBLIC_ANTHROPIC_COMPLETION_PER_M_TOKEN || 0),
  },
  'google-translate': {
    perMChar: Number(process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_PER_M_CHAR || 0),
  },
  'google-vision': {
    perRequest: Number(process.env.NEXT_PUBLIC_GOOGLE_VISION_PER_REQUEST || 0),
  },
};

const PROVIDER_PRICING_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/openai/gpt-5.2',
  openai: 'https://openai.com/pricing',
  anthropic: 'https://claude.com/pricing',
  'google-translate': 'https://cloud.google.com/translate/pricing',
  'google-vision': 'https://cloud.google.com/vision/pricing',
};

const formatCurrency = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(4)}`;
};

const formatRate = (value: number | undefined) => {
  if (!value || !Number.isFinite(value) || value <= 0) return '—';
  return `$${value.toFixed(4)}`;
};

export function UsageCost() {
  const { user } = useUser();
  const [selectedOrderId, setSelectedOrderId] = useState<Id<'orders'> | null>(null);
  const orders = useQuery(
    api.orders.getAllOrders,
    user?.id ? { clerkId: user.id } : 'skip'
  );
  const usageEvents = useQuery(
    api.usage.getUsageByOrder,
    selectedOrderId && user?.id ? { orderId: selectedOrderId, clerkId: user.id } : 'skip'
  ) as UsageEvent[] | undefined;

  const selectedOrder = useMemo(
    () => orders?.find((order) => order._id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const usageByProvider = useMemo(() => {
    if (!usageEvents) return [];

    const summary = new Map<
      string,
      {
        provider: string;
        models: Set<string>;
        inputChars: number;
        outputChars: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        requests: number;
      }
    >();

    // Aggregate usage per provider for the selected order.
    usageEvents.forEach((event) => {
      const key = event.provider;
      const entry =
        summary.get(key) ||
        {
          provider: key,
          models: new Set<string>(),
          inputChars: 0,
          outputChars: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          requests: 0,
        };

      if (event.model) {
        entry.models.add(event.model);
      }
      entry.inputChars += event.inputChars || 0;
      entry.outputChars += event.outputChars || 0;
      entry.promptTokens += event.promptTokens || 0;
      entry.completionTokens += event.completionTokens || 0;
      entry.totalTokens += event.totalTokens || 0;
      entry.requests += event.requests || 0;

      summary.set(key, entry);
    });

    return Array.from(summary.values()).map((entry) => {
      const rates = COST_RATES[entry.provider as keyof typeof COST_RATES];
      let estimatedCost: number | null = null;

      if (rates && 'promptPerMToken' in rates && 'completionPerMToken' in rates) {
        const promptRate = rates.promptPerMToken;
        const completionRate = rates.completionPerMToken;
        const hasTokenBreakdown = entry.promptTokens > 0 || entry.completionTokens > 0;
        const promptTokens = hasTokenBreakdown
          ? entry.promptTokens
          : Math.floor(entry.totalTokens / 2);
        const completionTokens = hasTokenBreakdown
          ? entry.completionTokens
          : Math.ceil(entry.totalTokens / 2);
        if (promptRate > 0 || completionRate > 0) {
          estimatedCost =
            (promptTokens / 1_000_000) * promptRate +
            (completionTokens / 1_000_000) * completionRate;
        }
      } else if (rates && 'perMChar' in rates && rates.perMChar > 0) {
        const totalChars = entry.inputChars + entry.outputChars;
        estimatedCost = (totalChars / 1_000_000) * rates.perMChar;
      } else if (rates && 'perRequest' in rates && rates.perRequest > 0) {
        estimatedCost = entry.requests * rates.perRequest;
      }

      return {
        ...entry,
        models: Array.from(entry.models).join(', ') || '—',
        label: PROVIDER_LABELS[entry.provider] || entry.provider,
        estimatedCost,
        pricingUrl: PROVIDER_PRICING_URLS[entry.provider],
        rates,
      };
    });
  }, [usageEvents]);

  const totalEstimatedCost = useMemo(() => {
    if (!usageByProvider.length) return null;
    const values = usageByProvider
      .map((row) => row.estimatedCost)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0);
  }, [usageByProvider]);

  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Usage & Cost</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select an order to see API usage totals.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {orders?.map((order) => (
                <tr key={order._id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {order.orderNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {order.userEmail || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(order.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedOrderId(order._id)}
                      className="text-primary hover:opacity-90"
                    >
                      View Usage
                    </button>
                  </td>
                </tr>
              ))}
              {!orders && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-sm text-muted-foreground">
                    Loading orders...
                  </td>
                </tr>
              )}
              {orders?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-sm text-muted-foreground">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Usage for {selectedOrder.orderNumber}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedOrder.userEmail || 'Unknown'} • {selectedOrder.totalPages} page(s)
              </p>
            </div>
            <button
              onClick={() => setSelectedOrderId(null)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    API
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Models
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pricing
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Requests
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Input Chars
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Output Chars
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Prompt Tokens
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Completion Tokens
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Tokens
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Estimated Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {usageByProvider.map((row) => (
                  <tr key={row.provider}>
                    <td className="px-4 py-2 text-sm text-foreground">{row.label}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{row.models}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        {row.pricingUrl ? (
                          <a
                            href={row.pricingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:opacity-90"
                          >
                            View pricing
                          </a>
                        ) : (
                          <span>—</span>
                        )}
                        {row.rates && 'promptPerMToken' in row.rates ? (
                          <span className="text-xs text-muted-foreground">
                            In: {formatRate(row.rates.promptPerMToken)}/MTok • Out:{' '}
                            {formatRate(row.rates.completionPerMToken)}/MTok
                          </span>
                        ) : row.rates && 'perMChar' in row.rates ? (
                          <span className="text-xs text-muted-foreground">
                            {formatRate(row.rates.perMChar)}/M chars
                          </span>
                        ) : row.rates && 'perRequest' in row.rates ? (
                          <span className="text-xs text-muted-foreground">
                            {formatRate(row.rates.perRequest)}/request
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Rate not set</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-muted-foreground">
                      {row.requests || 0}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-muted-foreground">
                      {row.inputChars || 0}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-muted-foreground">
                      {row.outputChars || 0}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-muted-foreground">
                      {row.promptTokens || 0}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-muted-foreground">
                      {row.completionTokens || 0}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-muted-foreground">
                      {row.totalTokens || 0}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-muted-foreground">
                      {formatCurrency(row.estimatedCost ?? null)}
                    </td>
                  </tr>
                ))}
                {usageByProvider.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-sm text-muted-foreground">
                      No usage recorded yet for this order.
                    </td>
                  </tr>
                )}
              </tbody>
              {usageByProvider.length > 0 && (
                <tfoot className="bg-muted/30">
                  <tr>
                    <td colSpan={9} className="px-4 py-3 text-sm font-medium text-right text-foreground">
                      Total Estimated Cost
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-foreground">
                      {formatCurrency(totalEstimatedCost)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Cost estimates use environment rates: `NEXT_PUBLIC_OPENROUTER_PROMPT_PER_M_TOKEN`,
            `NEXT_PUBLIC_OPENROUTER_COMPLETION_PER_M_TOKEN`, `NEXT_PUBLIC_OPENAI_PROMPT_PER_M_TOKEN`,
            `NEXT_PUBLIC_OPENAI_COMPLETION_PER_M_TOKEN`, `NEXT_PUBLIC_ANTHROPIC_PROMPT_PER_M_TOKEN`,
            `NEXT_PUBLIC_ANTHROPIC_COMPLETION_PER_M_TOKEN`, `NEXT_PUBLIC_GOOGLE_TRANSLATE_PER_M_CHAR`,
            `NEXT_PUBLIC_GOOGLE_VISION_PER_REQUEST`.
          </p>
        </div>
      )}
    </div>
  );
}
