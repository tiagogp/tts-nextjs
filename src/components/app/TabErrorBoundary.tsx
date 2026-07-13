"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useT } from "@/i18n/I18nProvider";

function TabErrorFallback({ onReset }: { onReset: () => void }) {
  const { t } = useT();
  return (
    <Card className="p-6 text-center">
      <p className="text-sm font-medium text-ink">{t("Something went wrong on this tab.")}</p>
      <p className="mt-1 text-xs text-ink-muted">
        {t("Try again, or switch to another tab.")}
      </p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={onReset}>
        {t("Try again")}
      </Button>
    </Card>
  );
}

interface TabErrorBoundaryProps {
  children: ReactNode;
}

interface TabErrorBoundaryState {
  hasError: boolean;
}

export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  state: TabErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Tab crashed:", error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) return <TabErrorFallback onReset={this.reset} />;
    return this.props.children;
  }
}
