"use client";

interface Props {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
}

export default function WizardStepper({ step, total, title, subtitle }: Props) {
  return (
    <header className="wz-stepper">
      <div className="wz-stepper-meta">
        STEP <strong>{step}</strong>/{total}
      </div>
      <h1 className="wz-stepper-title">{title}</h1>
      {subtitle && <p className="wz-stepper-subtitle">{subtitle}</p>}
    </header>
  );
}
