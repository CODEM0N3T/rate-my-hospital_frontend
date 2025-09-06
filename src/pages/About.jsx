export default function About() {
  return (
    <section className="about">
      <h1>About Rate My Hospital</h1>
      <p>
        Helping healthcare workers discover healthy workplace environments. This
        prototype displays official CMS facility data and HCAHPS patient
        experience metrics.
      </p>
      <ul>
        <li>
          <a
            href="https://data.cms.gov/provider-data/dataset/xubh-q36u"
            target="_blank"
            rel="noopener noreferrer"
          >
            Hospital General Information (CMS)
          </a>
        </li>
        <li>
          <a
            href="https://data.cms.gov/provider-data/dataset/dgck-syfz"
            target="_blank"
            rel="noopener noreferrer"
          >
            HCAHPS Patient Experience (CMS)
          </a>
        </li>
      </ul>
    </section>
  );
}
