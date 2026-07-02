import { Navigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/layout";
import { normalizeRole } from "@/constants/roles";
import { trainingRoutes } from "@/constants/routes";
import {
  TRAINING_CATEGORIES,
  guideBySlug,
  guidesForRole,
} from "@/content/training/guides";
import { useAuth } from "@/contexts/AuthContext";
import { TrainingGuideBody } from "@/pages/training/GuideContent";
import { MobileGuideQr } from "@/pages/training/MobileGuideQr";
import {
  TrainingBreadcrumb,
  TrainingContentCard,
  TrainingReadMeta,
} from "@/pages/training/training-ui";

export default function TrainingGuidePage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const guide = guideBySlug(slug);
  const allowed = guidesForRole(role).some((g) => g.slug === slug);

  if (!guide || !allowed) {
    return <Navigate to={trainingRoutes.hub} replace />;
  }

  const categoryTitle =
    TRAINING_CATEGORIES.find((category) => category.id === guide.category)
      ?.title ?? "Guide";

  return (
    <TrainingContentCard>
      <TrainingBreadcrumb category={categoryTitle} current={guide.title} />
      <PageHeader title={guide.title} description={guide.summary} />
      <TrainingReadMeta minutes={guide.readMinutes} />

      {guide.slug === "mobile-operator" ? (
        <div className="mb-8">
          <MobileGuideQr />
        </div>
      ) : null}

      <TrainingGuideBody blocks={guide.blocks} />
    </TrainingContentCard>
  );
}
