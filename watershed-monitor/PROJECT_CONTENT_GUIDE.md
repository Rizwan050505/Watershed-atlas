# Project content to complete before a public pilot

The site keeps unknown project details visibly marked as placeholders. Fill these with confirmed, public project information before a stakeholder presentation or deployment. Do not invent an agency, address, contact, watershed boundary, or field record.

## Public contact details

Set these values in the project `.env` file:

| Variable | What to enter | Current display when missing |
| --- | --- | --- |
| `VITE_PROJECT_ORGANIZATION` | Official department, agency, or implementing organization name, using its approved spelling. | “Add the official name” |
| `VITE_CONTACT_EMAIL` | A public project mailbox that the team checks regularly. Replace `contact@example.org`. | Sample email shown with a replacement note |
| `VITE_PROJECT_ADDRESS` | Public office postal address: office/building, street or locality, district/city, state, and PIN code. | “Address not supplied yet” and a format hint |
| `VITE_PROJECT_PHONE` | Optional public project phone or helpline, including area/country code if applicable. | An optional-field prompt |

The contact cards are in the landing page’s **Contact us** section and the email is repeated in the footer. Do not publish anyone’s private address or personal number.

After editing `.env`, recreate the web service so Vite reads the new values:

```powershell
docker compose up -d --force-recreate web
```

## Pilot-site details

Indore district, Madhya Pradesh is the selected **search area**. It is not a confirmed watershed site. After agreement with the concerned agency, record:

- The official watershed or micro-watershed name and its block/tehsil, district, and state.
- The boundary’s authoritative source, issuing organization, version/date, and coordinate reference system (CRS).
- Agency confirmation and permission to use the boundary and related records.
- The availability and usage permission for geo-coded field images and intervention records.
- The approved satellite data source, acquisition dates, resolution, processing method/version, and interpretation limitations.

The Overview and Spatial Workspace currently call out that exact-site selection is pending. The district reference point is for map navigation only; it is not a boundary or field observation.

## Demonstration records and data sources

The watershed boundary, intervention records, and observations seeded in `backend/sql/001_core.sql` are synthetic demonstration fixtures. Replace them only with authorized, source-documented records. Do not present them as measured results. Existing PostGIS volumes do not re-run the initialization SQL; use a reviewed migration or the available boundary import for an unverified candidate.

The map’s live NRSC/ISRO Bhuvan overlay is LULC 2015–16 at 1:250,000 scale. Direct SRISHTI-DRISHTI scenes and time-series indicators are not connected. Do not enter or describe fabricated satellite-analysis results.

## Where each item appears

- Organization, email, postal address, and optional phone: public landing page **Contact us** and footer.
- District and pilot-selection explanation: public **About** section, Overview, and map labels.
- Candidate boundary source and pilot status: Spatial Workspace after an admin imports a GeoJSON candidate; import does not confirm the pilot.
- Observation and intervention records: signed-in workspace modules and the observation CSV export.
- Bhuvan and satellite-data limitations: public Services information and the **Satellite Analysis** module.

Current build status: local development prototype. Before real field deployment, complete the production security, access, audit, backup, retention, and data-rights work described in `README.md`.
