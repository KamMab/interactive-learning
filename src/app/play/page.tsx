import JoinBox from "@/components/same/JoinBox";

// interactivelearning.io/play: where a class types in the code on the board.
export default function Play() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pt-6">
      <div><span className="eyebrow">Play</span><h1 className="big mt-2">Enter your game code</h1><p className="mt-2 text-muted">Your host has a code like <span className="mono">ioq-13b</span>. Type it in to join their game.</p></div>
      <JoinBox big />
    </div>
  );
}
