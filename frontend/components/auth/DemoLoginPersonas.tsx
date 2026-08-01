'use client';

import { DEMO_LOGIN_PERSONAS } from '@/lib/demo-login-personas';
import { isConnectorDemoUiEnabled } from '@/lib/demo-mode';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';

type Props = {
  onSelect: (email: string, password: string) => void;
};

export default function DemoLoginPersonas({ onSelect }: Props) {
  if (!isConnectorDemoUiEnabled()) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 space-y-3"
      data-testid="demo-login-personas"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Demo sign-in
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Non-production personas for {EXTERNAL_WORKFORCE_LABELS.productPlatform} demos.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DEMO_LOGIN_PERSONAS.map((persona) => (
          <button
            key={persona.id}
            type="button"
            onClick={() => onSelect(persona.email, persona.password)}
            className="text-left rounded-md border border-white bg-white px-3 py-2 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
          >
            <span className="block text-sm font-medium text-gray-900">
              {persona.audienceLabel}
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">{persona.experience}</span>
            <span className="block text-xs font-mono text-indigo-700 mt-1">{persona.email}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
