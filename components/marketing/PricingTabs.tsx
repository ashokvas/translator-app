'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PricingTabs() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Avoid Radix ID hydration mismatches by rendering Tabs only on client.
  if (!isMounted) return null;

  return (
    <Tabs defaultValue="general" className="max-w-4xl mx-auto">
      <div className="flex justify-center">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="certified">Certified</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="general" className="mt-6">
        <Card className="border-border">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">General Translation</CardTitle>
              <Badge variant="secondary">Most popular</Badge>
            </div>
            <CardDescription className="text-base">
              Great for everyday documents with fast turnaround.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <div>
                <div className="text-4xl font-bold text-primary">$15</div>
                <div className="text-sm text-muted-foreground">per page (starting)</div>
              </div>
              <Link href="/pricing">
                <Button variant="outline">View full pricing</Button>
              </Link>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Included</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-foreground font-medium">Translation</TableCell>
                  <TableCell className="text-muted-foreground">Professional translation</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-foreground font-medium">Delivery</TableCell>
                  <TableCell className="text-muted-foreground">Digital delivery</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-foreground font-medium">Turnaround</TableCell>
                  <TableCell className="text-muted-foreground">Standard + rush options</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="certified" className="mt-6">
        <Card className="border-border">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Certified Translation</CardTitle>
              <Badge variant="secondary">USCIS ready</Badge>
            </div>
            <CardDescription className="text-base">
              Certification, proofreading, and submission-ready formatting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <div>
                <div className="text-4xl font-bold text-primary">$25</div>
                <div className="text-sm text-muted-foreground">per page (starting)</div>
              </div>
              <Link href="/pricing">
                <Button variant="outline">View full pricing</Button>
              </Link>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Included</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-foreground font-medium">Certification</TableCell>
                  <TableCell className="text-muted-foreground">Signed certificate</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-foreground font-medium">Proofreading</TableCell>
                  <TableCell className="text-muted-foreground">Quality review</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-foreground font-medium">Formatting</TableCell>
                  <TableCell className="text-muted-foreground">Submission-ready</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="custom" className="mt-6">
        <Card className="border-border">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Custom / High Volume</CardTitle>
              <Badge variant="secondary">Best value</Badge>
            </div>
            <CardDescription className="text-base">
              For 100+ pages, teams, and specialized terminology workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <div>
                <div className="text-4xl font-bold text-primary">Custom</div>
                <div className="text-sm text-muted-foreground">quoted per project</div>
              </div>
              <Link href="/contact">
                <Button>Request a quote</Button>
              </Link>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Included</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-foreground font-medium">Project manager</TableCell>
                  <TableCell className="text-muted-foreground">Dedicated oversight</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-foreground font-medium">Volume discounts</TableCell>
                  <TableCell className="text-muted-foreground">Tiered pricing</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-foreground font-medium">Terminology</TableCell>
                  <TableCell className="text-muted-foreground">Specialized handling</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

