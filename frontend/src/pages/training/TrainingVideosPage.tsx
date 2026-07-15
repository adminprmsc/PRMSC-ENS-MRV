import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Film,
  Loader2,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  Upload,
  Video,
  Youtube,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout";
import { DataListCard, DataTableWrap } from "@/components/layout/tehsil-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  canAccessTrainingVideos,
  canPublishTrainingVideos,
} from "@/constants/roles";
import { trainingRoutes } from "@/constants/routes";
import { isValidTrainingVideoUrl, youtubeVideoId } from "@/content/training/youtube";
import {
  DEFAULT_TRAINING_VIDEO_AUDIENCE,
  TRAINING_VIDEO_AUDIENCE_OPTIONS,
  trainingAudienceLabel,
} from "@/content/training/audience";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/constants/roles";
import { getApiErrorMessage } from "@/lib/api-error";
import { TrainingVideoPlayer } from "@/pages/training/TrainingVideoPlayer";
import {
  TrainingContentCard,
  TrainingHero,
} from "@/pages/training/training-ui";
import {
  createTrainingVideo,
  deleteTrainingVideo,
  listTrainingVideos,
  updateTrainingVideo,
  uploadTrainingVideoFile,
  type TrainingVideo,
} from "@/services/trainingService";
import { cn } from "@/lib/utils";

type VideoSourceMode = "youtube" | "upload";

function videoSourceLabel(url: string): "YouTube" | "Uploaded file" {
  return youtubeVideoId(url) ? "YouTube" : "Uploaded file";
}

function formatVideoDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type VideoFormState = {
  title: string;
  description: string;
  youtube_url: string;
  sort_order: string;
  is_published: boolean;
  audience_roles: UserRole[];
};

const emptyForm = (): VideoFormState => ({
  title: "",
  description: "",
  youtube_url: "",
  sort_order: "0",
  is_published: false,
  audience_roles: [...DEFAULT_TRAINING_VIDEO_AUDIENCE],
});

export default function TrainingVideosPage() {
  const { user } = useAuth();
  const canView = canAccessTrainingVideos(user?.role);
  const canPublish = canPublishTrainingVideos(user?.role);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingVideo | null>(null);
  const [form, setForm] = useState<VideoFormState>(emptyForm);
  const [sourceMode, setSourceMode] = useState<VideoSourceMode>("youtube");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLoadedMb, setUploadLoadedMb] = useState(0);
  const [uploadTotalMb, setUploadTotalMb] = useState(0);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadVideos = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const rows = await listTrainingVideos(canPublish);
      setVideos(rows);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not load training videos"));
    } finally {
      setLoading(false);
    }
  }, [canView, canPublish]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  const visibleVideos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return videos;
    return videos.filter((video) => {
      const haystack = [
        video.title,
        video.description ?? "",
        ...video.audience_roles.map((role) => trainingAudienceLabel(role)),
        videoSourceLabel(video.youtube_url),
        video.is_published ? "published" : "draft",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [videos, searchQuery]);

  const selectedVideo = useMemo(
    () => visibleVideos.find((video) => video.id === selectedVideoId) ?? null,
    [visibleVideos, selectedVideoId],
  );

  useEffect(() => {
    if (!visibleVideos.length) {
      setSelectedVideoId(null);
      return;
    }
    if (
      !selectedVideoId ||
      !visibleVideos.some((video) => video.id === selectedVideoId)
    ) {
      setSelectedVideoId(visibleVideos[0]!.id);
    }
  }, [visibleVideos, selectedVideoId]);

  if (!canView) {
    return <Navigate to={trainingRoutes.hub} replace />;
  }

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setSourceMode("youtube");
    setUploadPercent(0);
    setUploadLoadedMb(0);
    setUploadTotalMb(0);
    setDialogOpen(true);
  };

  const openEdit = (video: TrainingVideo) => {
    setEditing(video);
    setForm({
      title: video.title,
      description: video.description ?? "",
      youtube_url: video.youtube_url,
      sort_order: String(video.sort_order),
      is_published: video.is_published,
      audience_roles: video.audience_roles?.length
        ? [...video.audience_roles]
        : [...DEFAULT_TRAINING_VIDEO_AUDIENCE],
    });
    setSourceMode(
      video.youtube_url.includes("youtube.com") ||
        video.youtube_url.includes("youtu.be")
        ? "youtube"
        : "upload",
    );
    setDialogOpen(true);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const totalMb = file.size / (1024 * 1024);
    setUploading(true);
    setUploadPercent(0);
    setUploadLoadedMb(0);
    setUploadTotalMb(Number(totalMb.toFixed(1)));
    try {
      const result = await uploadTrainingVideoFile(file, (progress) => {
        setUploadPercent(progress.percent);
        setUploadLoadedMb(
          Number((progress.loaded / (1024 * 1024)).toFixed(1)),
        );
        setUploadTotalMb(
          Number((progress.total / (1024 * 1024)).toFixed(1)),
        );
      });
      setUploadPercent(100);
      setForm((current) => ({ ...current, youtube_url: result.video_url }));
      toast.success("Video uploaded — URL filled automatically");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Video upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const toggleAudience = (code: UserRole, checked: boolean) => {
    setForm((current) => {
      const next = new Set(current.audience_roles);
      if (checked) next.add(code);
      else next.delete(code);
      return { ...current, audience_roles: [...next] };
    });
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.youtube_url.trim()) {
      toast.error("Title and video source are required");
      return;
    }
    if (!form.audience_roles.length) {
      toast.error("Select at least one audience role");
      return;
    }
    if (!isValidTrainingVideoUrl(form.youtube_url)) {
      toast.error("Enter a valid YouTube link or upload an MP4/WebM/MOV file");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        youtube_url: form.youtube_url.trim(),
        sort_order: Number.parseInt(form.sort_order, 10) || 0,
        is_published: form.is_published,
        audience_roles: form.audience_roles,
      };

      if (editing) {
        await updateTrainingVideo(editing.id, payload);
        toast.success("Video updated");
      } else {
        await createTrainingVideo(payload);
        toast.success("Video created");
      }
      setDialogOpen(false);
      await loadVideos();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not save video"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (video: TrainingVideo) => {
    if (!window.confirm(`Delete "${video.title}"?`)) return;
    try {
      await deleteTrainingVideo(video.id);
      toast.success("Video deleted");
      if (selectedVideoId === video.id) {
        setSelectedVideoId(null);
      }
      await loadVideos();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not delete video"));
    }
  };

  return (
    <div className="space-y-6">
      <TrainingHero
        title="Video library"
        description="Role-targeted recordings for Tehsil Managers and Manager Operations. Select a module from the directory to watch."
        moduleCount={1}
        moduleLabel="Libraries"
        guideCount={videos.length}
        guideLabel="Videos"
      />

      <TrainingContentCard>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-5">
          <PageHeader
            title="Training modules"
            description="Directory of published and draft recordings. Platform Administrators can upload to Supabase or link unlisted YouTube videos."
          />
          {canPublish ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Add video
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading video library…
          </div>
        ) : videos.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {canPublish
              ? "No videos yet. Upload an MP4 to Supabase or add an unlisted YouTube link."
              : "No published videos are available for your role yet."}
          </p>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <DataListCard
              title="Module directory"
              count={visibleVideos.length}
              search={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by title, audience, or status…"
              toolbar={
                <p className="max-w-xs text-xs text-muted-foreground">
                  Ordered by display priority, then newest updates.
                </p>
              }
            >
              {visibleVideos.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No videos match your search.
                </p>
              ) : (
                <DataTableWrap>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Module</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          Source
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          Audience
                        </TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleVideos.map((video) => {
                        const isSelected = video.id === selectedVideoId;
                        const source = videoSourceLabel(video.youtube_url);
                        return (
                          <TableRow
                            key={video.id}
                            tabIndex={0}
                            className={cn(
                              "cursor-pointer transition-colors",
                              isSelected && "bg-primary/5",
                            )}
                            onClick={() => setSelectedVideoId(video.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedVideoId(video.id);
                              }
                            }}
                          >
                            <TableCell>
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border shadow-sm",
                                    isSelected
                                      ? "border-primary/30 bg-primary text-primary-foreground"
                                      : "border-border/60 bg-muted/40 text-muted-foreground",
                                  )}
                                >
                                  {source === "YouTube" ? (
                                    <Youtube className="size-4" />
                                  ) : (
                                    <Video className="size-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">
                                    {video.title}
                                  </p>
                                  {video.description ? (
                                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                      {video.description}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                              {source}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {video.audience_roles.map((role) => (
                                  <Badge
                                    key={role}
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {trainingAudienceLabel(role)}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {video.is_published ? (
                                <Badge className="text-xs">Published</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Draft
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </DataTableWrap>
              )}
            </DataListCard>

            <Card className="overflow-hidden border-border/70 shadow-sm xl:sticky xl:top-4 xl:self-start">
              <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Film className="size-4 text-primary" />
                  Player
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 md:p-5">
                {selectedVideo ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Now playing
                        </p>
                        <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                          {selectedVideo.title}
                        </h2>
                        {selectedVideo.description ? (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {selectedVideo.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{videoSourceLabel(selectedVideo.youtube_url)}</span>
                          <span>·</span>
                          <span>
                            Updated {formatVideoDate(selectedVideo.updated_at)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedVideo.audience_roles.map((role) => (
                            <Badge key={role} variant="outline" className="text-xs">
                              {trainingAudienceLabel(role)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {canPublish ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(selectedVideo)}
                          >
                            <Pencil className="mr-1 size-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleDelete(selectedVideo)}
                          >
                            <Trash2 className="mr-1 size-3.5" />
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <TrainingVideoPlayer
                      title={selectedVideo.title}
                      url={selectedVideo.youtube_url}
                    />
                  </>
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/15 px-6 text-center text-sm text-muted-foreground">
                    <PlayCircle className="size-10 text-muted-foreground/40" />
                    <p>Select a module from the directory to start playback.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </TrainingContentCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit training video" : "Add training video"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="video-title">Title</Label>
              <Input
                id="video-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Video source</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={sourceMode === "youtube" ? "default" : "outline"}
                  onClick={() => setSourceMode("youtube")}
                >
                  YouTube link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={sourceMode === "upload" ? "default" : "outline"}
                  onClick={() => setSourceMode("upload")}
                >
                  Upload to Supabase
                </Button>
              </div>
            </div>

            {sourceMode === "youtube" ? (
              <div className="space-y-2">
                <Label htmlFor="video-url">YouTube URL (unlisted)</Label>
                <Input
                  id="video-url"
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={form.youtube_url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, youtube_url: e.target.value }))
                  }
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Video file (MP4, WebM, or MOV — max 200 MB)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  className="hidden"
                  onChange={(e) => void handleFileChange(e)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Uploading {uploadPercent}%
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 size-4" />
                      Choose video file
                    </>
                  )}
                </Button>
                {uploading ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                      <span>Upload progress</span>
                      <span className="tabular-nums font-medium text-slate-800">
                        {uploadPercent}% · {uploadLoadedMb} / {uploadTotalMb}{" "}
                        MB
                      </span>
                    </div>
                    <Progress value={uploadPercent} className="w-full" />
                    <p className="text-xs text-slate-500">
                      Keep this dialog open until the upload finishes.
                    </p>
                  </div>
                ) : null}
                {form.youtube_url ? (
                  <p className="break-all text-xs text-slate-600">
                    <span className="font-medium text-slate-800">
                      Auto-generated URL:{" "}
                    </span>
                    {form.youtube_url}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    After upload, the Supabase public URL is saved
                    automatically.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="video-desc">Description</Label>
              <Textarea
                id="video-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-sort">Sort order</Label>
              <Input
                id="video-sort"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sort_order: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <p className="text-xs text-slate-500">
                Only selected roles will see this video when published.
              </p>
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                {TRAINING_VIDEO_AUDIENCE_OPTIONS.map((option) => (
                  <label
                    key={option.code}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={form.audience_roles.includes(option.code)}
                      onCheckedChange={(checked) =>
                        toggleAudience(option.code, checked === true)
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.is_published}
                onCheckedChange={(checked) =>
                  setForm((f) => ({
                    ...f,
                    is_published: checked === true,
                  }))
                }
              />
              Published
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || uploading}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
