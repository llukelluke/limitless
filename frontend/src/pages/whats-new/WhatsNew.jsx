import { PageHeader, Panel } from '../../components/AdminUI.jsx'
import { formatDate } from '../../constants.js'
import { RELEASES } from '../../releases.js'
import './WhatsNew.css'

// What's New: release notes for every version, newest first.
export default function WhatsNew() {
  return (
    <>
      <PageHeader eyebrow="UPDATES" title="What's New" subtitle="Every version of Limitless and what changed in it." />
      <Panel title="RELEASE NOTES" className="page-panel">
        <ol className="releases">
          {RELEASES.map((release) => (
            <li key={release.version} className="release">
              <h3 className="release__title">
                Version {release.version} <span className="release__date">· {formatDate(release.date)}</span>
              </h3>
              <p className="release__name">{release.title}</p>
              <ul className="release__changes">
                {release.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  )
}
