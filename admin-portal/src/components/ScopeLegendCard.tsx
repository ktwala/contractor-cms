import { Card, CardHeader } from '../ui/layout';

/**
 * Shared scope legend used across Role Templates and Users pages.
 * GLOBAL roles apply across the tenant; LEGAL_ENTITY roles apply only to specific companies.
 */
export function ScopeLegendCard() {
  return (
    <Card>
      <CardHeader
        title="Scope legend"
        subtitle="GLOBAL roles apply across the tenant. LEGAL_ENTITY roles apply only to specific companies."
      />
    </Card>
  );
}
