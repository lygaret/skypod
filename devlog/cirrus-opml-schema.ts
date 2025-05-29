import { Parser as XmlParser } from 'htmlparser2'

export type OPMLItem = {
    title: string | null,
    type: string | null,
    xmlUrl: string | null,
    htmlUrl: string | null
}

export async function parseOPML(blob: Blob): Promise<OPMLItem[]> {
    const outlines: OPMLItem[] = []
    const parser = new XmlParser({
        onopentag(name, attribs) {
            if (name !== 'outline' || !attribs['xmlurl'])
                return

            outlines.push({
                title: attribs['title'] || attribs['text'],
                xmlUrl: attribs['xmlurl'],
                htmlUrl: attribs['htmlurl'],
                type: attribs['type'],
            })
        },
    })

    parser.write(await blob.text())
    parser.end()
    return outlines;
}