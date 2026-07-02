import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  HelpCircle,
  PlayCircle,
  Smartphone,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  canAccessTrainingVideos,
  normalizeRole,
} from "@/constants/roles";
import { trainingRoutes } from "@/constants/routes";
import {
  TRAINING_CATEGORIES,
  guidesForRole,
  type TrainingCategoryId,
} from "@/content/training/guides";
import { useAuth } from "@/contexts/AuthContext";
import {
  TrainingContentCard,
  TrainingHero,
  TrainingModuleCard,
} from "@/pages/training/training-ui";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<TrainingCategoryId, typeof BookOpen> = {
  "getting-started": GraduationCap,
  "by-role": BookOpen,
  mobile: Smartphone,
  tasks: BookOpen,
  faqs: HelpCircle,
};

export function TrainingHub() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const visibleGuides = guidesForRole(role);
  const showVideos = canAccessTrainingVideos(user?.role);

  const activeModules = TRAINING_CATEGORIES.filter((category) =>
    visibleGuides.some((guide) => guide.category === category.id),
  );

  return (
    <div className="space-y-6">
      <TrainingHero
        moduleCount={activeModules.length}
        guideCount={visibleGuides.length}
        showVideos={showVideos}
      />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {TRAINING_CATEGORIES.map((category) => {
          const guides = visibleGuides.filter(
            (guide) => guide.category === category.id,
          );
          if (!guides.length) return null;
          const Icon = CATEGORY_ICONS[category.id];

          return (
            <TrainingModuleCard
              key={category.id}
              icon={<Icon className="size-5" />}
              title={category.title}
              description={category.description}
              guides={guides}
            />
          );
        })}

        {showVideos ? (
          <TrainingContentCard className="flex h-full flex-col justify-between border-dashed bg-muted/10">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-primary shadow-sm">
                <PlayCircle className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold tracking-tight text-foreground">
                  Video library
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Watch role-specific training recordings published by Platform
                  Administration.
                </p>
              </div>
            </div>
            <Link
              to={trainingRoutes.videos}
              className={cn(
                buttonVariants({ variant: "default" }),
                "mt-6 w-full sm:w-auto",
              )}
            >
              Browse video library
              <ChevronRight className="ml-1 size-4" />
            </Link>
          </TrainingContentCard>
        ) : null}
      </div>
    </div>
  );
}
