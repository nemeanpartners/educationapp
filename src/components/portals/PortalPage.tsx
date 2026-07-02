interface PortalPageProps {
  portalName: string;
}

export default function PortalPage({ portalName }: PortalPageProps) {
  return (
    <div className="p-12 border-2 border-dashed border-zinc-200 rounded-3xl text-center">
      <h1 className="text-4xl font-black text-zinc-900">This is the {portalName}</h1>
      <p className="text-zinc-500 mt-4">Testing portal interface.</p>
    </div>
  );
}
