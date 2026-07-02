import { useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BookOpen, ChevronLeft, PlayCircle } from "lucide-react";

import { PageShell } from "@/components/layout";
import {
  canAccessTrainingVideos,
  normalizeRole,
} from "@/constants/roles";
import { trainingRoutes } from "@/constants/routes";
import {
  TRAINING_CATEGORIES,
  guidesInCategory,
} from "@/content/training/guides";
import { useAuth } from "@/contexts/AuthContext";
import {
  TrainingGuideLink,
  TrainingNavLink,
  TrainingSectionLabel,
  TrainingSidebarHeader,
} from "@/pages/training/training-ui";

export default function TrainingLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const role = normalizeRole(user?.role);
  const showVideos = canAccessTrainingVideos(user?.role);

  const sidebarSections = useMemo(() => {
    return TRAINING_CATEGORIES.map((category) => ({
      ...category,
      guides: guidesInCategory(category.id, role),
    })).filter((section) => section.guides.length > 0);
  }, [role]);

  const isHub = location.pathname === trainingRoutes.hub;
  const isVideos = location.pathname === trainingRoutes.videos;

  return (
    <PageShell className="max-w-7xl">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <aside className="w-full shrink-0 xl:sticky xl:top-4 xl:w-72">
          <nav
            aria-label="Training center"
            className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
          >
            <TrainingSidebarHeader />
            <div className="space-y-1 p-2">
              <TrainingNavLink
                to={trainingRoutes.hub}
                icon={<BookOpen className="size-3.5" />}
                label="Overview"
                active={isHub}
              />

              {sidebarSections.map((section) => (
                <div key={section.id}>
                  <TrainingSectionLabel>{section.title}</TrainingSectionLabel>
                  <ul className="space-y-0.5">
                    {section.guides.map((guide) => {
                      const path = trainingRoutes.guide(guide.slug);
                      return (
                        <li key={guide.slug}>
                          <TrainingGuideLink
                            to={path}
                            label={guide.title}
                            active={location.pathname === path}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {showVideos ? (
                <div className="border-t border-border/60 pt-2">
                  <TrainingNavLink
                    to={trainingRoutes.videos}
                    icon={<PlayCircle className="size-3.5" />}
                    label="Video library"
                    active={isVideos}
                  />
                </div>
              ) : null}
            </div>
          </nav>

          {!isHub ? (
            <Link
              to={trainingRoutes.hub}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
              Back to overview
            </Link>
          ) : null}
        </aside>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </PageShell>
  );
}
