const WEB_POINTS = [
    "Watch your sessions as they work",
    "Send new instructions or questions",
    "Approve Allow / Deny from your phone",
] as const;

const PC_POINTS = [
    "Pick a tab and pull it over",
    "It lands as a real session, ready to continue",
    "The full context travels, nothing to re-explain",
] as const;

export default function FeaturesSection() {
    return (
        <section className="border-t border-line">
            <div className="mx-auto w-full max-w-6xl px-4 py-16">
                <h2 className="text-2xl font-bold tracking-tight">Wherever you are</h2>
                <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-line">
                    <div className="md:pr-12">
                        <h3 className="text-lg font-bold">On the web</h3>
                        <p className="mt-1 text-sm text-dim">
                            Leave the PC running. From any browser.
                        </p>
                        <ul className="mt-4 space-y-2">
                            {WEB_POINTS.map((point) => (
                                <li key={point} className="flex gap-2 text-sm text-fog">
                                    <span className="font-mono text-go">&gt;</span>
                                    {point}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="md:pl-12">
                        <h3 className="text-lg font-bold">On another PC</h3>
                        <p className="mt-1 text-sm text-dim">
                            Heading out with the laptop. Pick up mid-work.
                        </p>
                        <ul className="mt-4 space-y-2">
                            {PC_POINTS.map((point) => (
                                <li key={point} className="flex gap-2 text-sm text-fog">
                                    <span className="font-mono text-go">&gt;</span>
                                    {point}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
