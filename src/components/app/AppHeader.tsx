"use client";

import { type MouseEvent, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { springSnappy } from "@/lib/motion";
import { HOME_TABS, type HomeTab } from "@/components/app/homeTabs";
import { IconButton } from "@/components/ui/IconButton";
import { toggleElectronFullscreen } from "@/platform/electron/bridge";

const emptySubscribe = () => () => {};

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
  settingsOpen: boolean;
  onSettingsOpen: () => void;
}

export default function AppHeader({ activeTab, onTabChange, settingsOpen, onSettingsOpen }: AppHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isClient = useIsClient();
  const isDark = isClient && resolvedTheme === "dark";

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
    toggleElectronFullscreen();
  };

  return (
    <header
      className="sticky top-0 z-20 border-b border-line bg-card"
      onDoubleClick={toggleWindowFullscreen}
    >
      <div className="app-header-inner max-w-5xl mx-auto px-4">
        <div className="min-w-0" data-no-window-drag="true">
          <div className="flex items-center min-w-0">
            <h1 className="brand-wordmark text-[1.35rem] font-normal leading-none text-ink">PhraseLoop</h1>
            <h1 className="brand-wordmark text-[1.35rem] font-normal leading-none text-fin">.</h1>
          </div>
        </div>

        <div
          className="app-header-nav relative grid grid-cols-4"
          role="tablist"
          aria-label="PhraseLoop sections"
          data-no-window-drag="true"
          data-ignore-window-double-click="true"
        >
          {HOME_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className="app-tab relative py-4 text-sm font-medium transition-colors duration-200"
                data-active={active}
                role="tab"
                aria-selected={active && !settingsOpen}
                aria-controls={`panel-${tab.id}`}
                type="button"
              >
                {tab.label}
                {active && (
                  <motion.span
                    layoutId="tab-underline"
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent"
                    transition={springSnappy}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1" data-no-window-drag="true">
          <IconButton onClick={toggleDark} aria-label="Toggle dark mode">
            {isDark ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </IconButton>

          <IconButton
            onClick={onSettingsOpen}
            active={settingsOpen}
            aria-label="Open settings"
            aria-pressed={settingsOpen}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke="currentColor" strokeWidth="1.7" />
              <path d="M19.4 15a1.7 1.7 0 00.34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 00-1.88-.34 1.7 1.7 0 00-1.03 1.56V21h-4v-.08A1.7 1.7 0 008.94 19.4a1.7 1.7 0 00-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 004.57 15 1.7 1.7 0 003 14H3v-4h.08A1.7 1.7 0 004.6 8.94a1.7 1.7 0 00-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 009 4.57 1.7 1.7 0 0010 3.08V3h4v.08a1.7 1.7 0 001.06 1.52 1.7 1.7 0 001.88-.34L17 4.2 19.83 7l-.06.06a1.7 1.7 0 00-.34 1.88A1.7 1.7 0 0021 10h.08v4H21a1.7 1.7 0 00-1.6 1z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
        </div>
      </div>
    </header>
  );
}
