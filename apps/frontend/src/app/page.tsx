// TODO(M2): fetch from NEXT_PUBLIC_API_BASE_URL + /api/products (paginated
// listing per FR-CAT-001) and render real ProductCard entries instead of
// this static placeholder.

export default function HomePage(): JSX.Element {
  return (
    <main>
      <h1>RingDog</h1>
      <p>
        Keyrings and keychains, plus a Datadog observability demo running underneath: RUM, APM,
        Logs, DSM, and LLM Observability all wired through this storefront.
      </p>
    </main>
  );
}
