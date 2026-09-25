import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 42
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const BODY_COLOR = rgb(32 / 255, 48 / 255, 66 / 255)
const PRIMARY_COLOR = rgb(38 / 255, 91 / 255, 143 / 255)
const MUTED_COLOR = rgb(84 / 255, 103 / 255, 122 / 255)
const HEADER_COLOR = rgb(38 / 255, 91 / 255, 143 / 255)
const WHITE = rgb(1, 1, 1)

export type MedicalFollowUpPdfSource = {
  trainer_level: string | null
  nom_formateur: string | null
  prenom_formateur: string | null
  email_formateur: string | null
  date_formation: string | null
  journee: string | null
  conditions_meteo: string | null
  temperature: string | null
  hydratation_avant_bruleage: string | null
  hydratation_apres_bruleage: string | null
  lieu_formation: string | null
  lieu_formation_autre: string | null
  formation: string | null
  formation_autre: string | null
  role_formateur: string | null
  role_formateur_autre: string | null
  type_bruleage: string | null
  type_bruleage_autre: string | null
  temps_ari: string | null
  decontamination_post_bruleage: string | null
  douche_dans_heure: string | null
  observations_post_bruleage: string[] | null
  observations_post_bruleage_autre: string | null
  observations: string | null
}

function pdfSafeText(value: unknown, fallback = 'Non renseigné') {
  const text = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')
    .trim()
  return text || fallback
}

function choiceWithOther(choice: unknown, other: unknown) {
  const primary = pdfSafeText(choice)
  const detail = String(other ?? '').trim()
  return detail ? `${primary} ${pdfSafeText(detail)}` : primary
}

function wrapText(
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  value: string,
  fontSize: number,
  width: number,
) {
  const words = pdfSafeText(value).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (font.widthOfTextAtSize(word, fontSize) > width) {
      if (current) {
        lines.push(current)
        current = ''
      }
      let chunk = ''
      for (const character of word) {
        const candidate = `${chunk}${character}`
        if (chunk && font.widthOfTextAtSize(candidate, fontSize) > width) {
          lines.push(chunk)
          chunk = character
        } else {
          chunk = candidate
        }
      }
      current = chunk
      continue
    }

    const candidate = current ? `${current} ${word}` : word
    if (current && font.widthOfTextAtSize(candidate, fontSize) > width) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['Non renseigné']
}

function drawHeader(
  page: ReturnType<PDFDocument['addPage']>,
  boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>,
  regularFont: Awaited<ReturnType<PDFDocument['embedFont']>>,
  title: string,
  pageNumber: number,
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 78,
    width: PAGE_WIDTH,
    height: 78,
    color: HEADER_COLOR,
  })
  page.drawText('FLASHOVER 78', {
    x: MARGIN,
    y: PAGE_HEIGHT - 28,
    size: 10,
    font: boldFont,
    color: WHITE,
  })
  page.drawText(pdfSafeText(title), {
    x: MARGIN,
    y: PAGE_HEIGHT - 53,
    size: 16,
    font: boldFont,
    color: WHITE,
  })
  page.drawLine({
    start: { x: MARGIN, y: 38 },
    end: { x: PAGE_WIDTH - MARGIN, y: 38 },
    thickness: 0.5,
    color: rgb(167 / 255, 192 / 255, 214 / 255),
  })
  page.drawText(`GFO 78 · Page ${pageNumber}`, {
    x: MARGIN,
    y: 23,
    size: 8,
    font: regularFont,
    color: MUTED_COLOR,
  })
}

export async function renderMedicalFollowUpPdf(
  source: MedicalFollowUpPdfSource,
  isEvolution: boolean,
) {
  const pdf = await PDFDocument.create()
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const title = isEvolution ? 'Evolution Suivi médical' : 'Suivi médical formateur'
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let pageNumber = 1
  let cursor = PAGE_HEIGHT - 112
  drawHeader(page, boldFont, regularFont, title, pageNumber)

  const drawField = (label: string, value: string) => {
    const labelText = pdfSafeText(label)
    const valueLines = wrapText(regularFont, value, 10, CONTENT_WIDTH - 150)
    const blockHeight = Math.max(28, valueLines.length * 13 + 20)
    if (cursor - blockHeight < 58) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      pageNumber += 1
      cursor = PAGE_HEIGHT - 112
      drawHeader(page, boldFont, regularFont, title, pageNumber)
    }

    page.drawText(labelText, {
      x: MARGIN,
      y: cursor,
      size: 9,
      font: boldFont,
      color: PRIMARY_COLOR,
    })
    valueLines.forEach((line, index) => {
      page.drawText(line, {
        x: MARGIN + 150,
        y: cursor - index * 13,
        size: 10,
        font: regularFont,
        color: BODY_COLOR,
      })
    })
    cursor -= blockHeight
  }

  drawField('Fonction', pdfSafeText(source.trainer_level))
  drawField(
    'Formateur',
    `${pdfSafeText(source.nom_formateur)} ${pdfSafeText(source.prenom_formateur)}`,
  )
  drawField('Email', pdfSafeText(source.email_formateur))
  drawField('Date de formation', pdfSafeText(source.date_formation))
  drawField('Journée', pdfSafeText(source.journee))
  drawField('Lieu', choiceWithOther(source.lieu_formation, source.lieu_formation_autre))
  drawField('Formation', choiceWithOther(source.formation, source.formation_autre))
  drawField('Rôle formateur', choiceWithOther(source.role_formateur, source.role_formateur_autre))
  drawField('Conditions météo', pdfSafeText(source.conditions_meteo))
  drawField('Température', pdfSafeText(source.temperature))
  drawField('Hydratation avant brûlage', pdfSafeText(source.hydratation_avant_bruleage))
  drawField('Hydratation après brûlage', pdfSafeText(source.hydratation_apres_bruleage))
  drawField('Type de brûlage', choiceWithOther(source.type_bruleage, source.type_bruleage_autre))
  drawField('Temps sous ARI', pdfSafeText(source.temps_ari))
  drawField('Décontamination', pdfSafeText(source.decontamination_post_bruleage))
  drawField('Douche dans l’heure', pdfSafeText(source.douche_dans_heure))

  const postObservations = (source.observations_post_bruleage ?? [])
    .map((value) => pdfSafeText(value))
    .filter(Boolean)
    .join(', ')
  const postObservationText = source.observations_post_bruleage_autre
    ? `${postObservations}${postObservations ? ' · ' : ''}${pdfSafeText(source.observations_post_bruleage_autre)}`
    : postObservations
  drawField('Observations post-brûlage', postObservationText || 'Aucune')
  drawField('Observations complémentaires', pdfSafeText(source.observations, 'Aucune'))

  pdf.setTitle(title)
  pdf.setAuthor('Flashover 78')
  return new Uint8Array(await pdf.save({
    addDefaultPage: false,
    updateFieldAppearances: false,
    useObjectStreams: false,
  }))
}
