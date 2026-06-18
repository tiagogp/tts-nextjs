"use client";

import { type MouseEvent, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { HOME_TABS, type HomeTab } from "@/components/homeTabs";

const emptySubscribe = () => () => {};

declare global {
  interface Window {
    phraseLoop?: {
      toggleFullscreen: () => void;
    };
  }
}

function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

interface AppHeaderProps {
  activeTab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
}

export default function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isClient = useIsClient();
  const isDark = isClient && resolvedTheme === "dark";
  const activeTabIndex = Math.max(
    0,
    HOME_TABS.findIndex((tab) => tab.id === activeTab),
  );

  const toggleDark = () => setTheme(isDark ? "light" : "dark");

  const toggleWindowFullscreen = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      target.closest(
        "button,a,input,select,textarea,[role='button'],[data-ignore-window-double-click='true']",
      )
    ) {
      return;
    }
    window.phraseLoop?.toggleFullscreen();
  };

  return (
    <header
      className="sticky top-0 z-20"
      style={{
        backgroundColor: "var(--surface-card)",
        borderBottom: "1px solid var(--border)",
      }}
      onDoubleClick={toggleWindowFullscreen}
    >
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
        <div className="min-w-0" data-no-window-drag="true">
          <div className="flex items-center min-w-0">
            <h1
              className="brand-wordmark text-[1.35rem] font-normal leading-none"
              style={{ color: "var(--text-primary)" }}
            >
              PhraseLoop
            </h1>
            <h1
              className="brand-wordmark text-[1.35rem] font-normal leading-none"
              style={{ color: "var(--color-fin)" }}
            >
              .
            </h1>
          </div>
        </div>

        <div className="flex-1 self-stretch" aria-hidden="true" />

        <button
          onClick={toggleDark}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--surface-raised, #f0ede8)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
          aria-label="Toggle dark mode"
          type="button"
        >
          {isDark ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <div
          className="relative grid grid-cols-4"
          data-no-window-drag="true"
          data-ignore-window-double-click="true"
        >
          <span
            className="absolute bottom-0 left-0 h-0.5 w-1/4 rounded-full transition-transform duration-300 ease-out"
            style={{
              backgroundColor: "var(--accent)",
              transform: `translateX(${activeTabIndex * 100}%)`,
            }}
            aria-hidden="true"
          />
          {HOME_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="app-tab relative py-3 text-sm font-medium transition-colors duration-200"
                data-active={active}
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
