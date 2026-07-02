import { youtubeEmbedUrl, isDirectVideoFileUrl } from "@/content/training/youtube";

type TrainingVideoPlayerProps = {
  title: string;
  url: string;
};

export function TrainingVideoPlayer({ title, url }: TrainingVideoPlayerProps) {
  const embed = youtubeEmbedUrl(url);

  if (embed) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/70 bg-black shadow-sm">
        <iframe
          title={title}
          src={embed}
          className="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (isDirectVideoFileUrl(url)) {
    return (
      <div className="overflow-hidden rounded-lg border border-border/70 bg-black shadow-sm">
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full"
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  return (
    <p className="text-sm text-red-600">
      Invalid video URL — edit to fix or re-upload.
    </p>
  );
}
