'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NoticeDialog, type NoticeState } from '@/components/ui/notice-dialog';

export function PricingSettings() {
  const { user } = useUser();
  const pricing = useQuery(api.settings.getPricing);
  const updatePricing = useMutation(api.settings.updatePricing);

  const [certifiedBase, setCertifiedBase] = useState(25);
  const [certifiedRush, setCertifiedRush] = useState(25);
  const [generalBase, setGeneralBase] = useState(15);
  const [generalRush, setGeneralRush] = useState(15);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  // Initialize form values when pricing data loads
  useEffect(() => {
    if (pricing) {
      setCertifiedBase(pricing.certified.basePerPage);
      setCertifiedRush(pricing.certified.rushExtraPerPage);
      setGeneralBase(pricing.general.basePerPage);
      setGeneralRush(pricing.general.rushExtraPerPage);
    }
  }, [pricing]);

  const handleSave = async () => {
    if (!user?.id) {
      setNotice({ title: 'Sign in required', message: 'Please sign in to update pricing.' });
      return;
    }

    // Validate inputs
    if (certifiedBase <= 0 || certifiedRush < 0 || generalBase <= 0 || generalRush < 0) {
      setNotice({ title: 'Invalid pricing', message: 'Prices must be positive numbers.' });
      return;
    }

    setIsSaving(true);
    try {
      await updatePricing({
        clerkId: user.id,
        pricing: {
          certified: {
            basePerPage: certifiedBase,
            rushExtraPerPage: certifiedRush,
          },
          general: {
            basePerPage: generalBase,
            rushExtraPerPage: generalRush,
          },
        },
      });

      setNotice({ title: 'Saved', message: 'Pricing settings updated successfully!' });
    } catch (error) {
      console.error('Failed to update pricing:', error);
      setNotice({
        title: 'Update failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    pricing &&
    (certifiedBase !== pricing.certified.basePerPage ||
      certifiedRush !== pricing.certified.rushExtraPerPage ||
      generalBase !== pricing.general.basePerPage ||
      generalRush !== pricing.general.rushExtraPerPage);

  return (
    <div className="space-y-6">
      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />

      <div>
        <h2 className="text-2xl font-bold text-foreground">Pricing Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure per-page pricing for certified and general translation services. Changes apply to new orders immediately.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Certified Translation Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Certified Translation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Base Rate (per page)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={certifiedBase}
                  onChange={(e) => setCertifiedBase(parseFloat(e.target.value) || 0)}
                  className="flex-1 border border-border bg-background text-foreground rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Standard delivery (7 days)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Rush Extra (per page)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">+$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={certifiedRush}
                  onChange={(e) => setCertifiedRush(parseFloat(e.target.value) || 0)}
                  className="flex-1 border border-border bg-background text-foreground rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Rush delivery (24 hours)
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Standard total:</span>
                <span className="font-semibold">${certifiedBase.toFixed(2)}/page</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Rush total:</span>
                <span className="font-semibold text-orange-400">
                  ${(certifiedBase + certifiedRush).toFixed(2)}/page
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* General Translation Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>General Translation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Base Rate (per page)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={generalBase}
                  onChange={(e) => setGeneralBase(parseFloat(e.target.value) || 0)}
                  className="flex-1 border border-border bg-background text-foreground rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Standard delivery (7 days)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Rush Extra (per page)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">+$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={generalRush}
                  onChange={(e) => setGeneralRush(parseFloat(e.target.value) || 0)}
                  className="flex-1 border border-border bg-background text-foreground rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Rush delivery (24 hours)
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Standard total:</span>
                <span className="font-semibold">${generalBase.toFixed(2)}/page</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Rush total:</span>
                <span className="font-semibold text-orange-400">
                  ${(generalBase + generalRush).toFixed(2)}/page
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Translation Note */}
      <Card className="bg-muted/40 border-border">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-primary mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Custom Translation Pricing</h4>
              <p className="text-sm text-muted-foreground">
                Custom translation orders (100+ pages) use quote-based pricing. You'll set the quote amount manually for each custom order in the Order Management section.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4">
        {hasChanges && (
          <span className="text-sm text-orange-400">
            You have unsaved changes
          </span>
        )}
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          size="lg"
        >
          {isSaving ? 'Saving...' : 'Save Pricing Settings'}
        </Button>
      </div>
    </div>
  );
}
