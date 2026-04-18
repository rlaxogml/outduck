interface GoogleAdProps {
  position: "left" | "right";
}

export function GoogleAd({ position }: GoogleAdProps) {
  return (
    <div
      className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 ${
        position === "left" ? "left-4" : "right-4"
      }`}
    >
      <div className="w-[120px] h-[600px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center bg-muted/30">
        <div className="writing-mode-vertical text-muted-foreground text-sm font-medium tracking-wider">
          <span className="inline-block [writing-mode:vertical-lr]">
            Google 광고
          </span>
        </div>
      </div>
    </div>
  );
}
