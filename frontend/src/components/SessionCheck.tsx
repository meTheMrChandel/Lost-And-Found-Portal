/** Full-page placeholder shown while the signed-in state is being checked. */
export default function SessionCheck({ message = "Checking your session..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#047857] border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-[#6B7280]">{message}</span>
      </div>
    </div>
  );
}
