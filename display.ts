// @ts-ignore FIXME add types to library
import { DwarfClient } from 'dfhack-remote'

const tiles = getTiles()

type UInt3 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
type ColorID = 0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15
type UInt8 =
    0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|
    16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|
    32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|
    48|49|50|51|52|53|54|55|56|57|58|59|60|61|62|63|
    64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|
    80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|
    96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|
    112|113|114|115|116|117|118|119|120|121|122|123|124|125|126|127|
    128|129|130|131|132|133|134|135|136|137|138|139|140|141|142|143|
    144|145|146|147|148|149|150|151|152|153|154|155|156|157|158|159|
    160|161|162|163|164|165|166|167|168|169|170|171|172|173|174|175|
    176|177|178|179|180|181|182|183|184|185|186|187|188|189|190|191|
    192|193|194|195|196|197|198|199|200|201|202|203|204|205|206|207|
    208|209|210|211|212|213|214|215|216|217|218|219|220|221|222|223|
    224|225|226|227|228|229|230|231|232|233|234|235|236|237|238|239|
    240|241|242|243|244|245|246|247|248|249|250|251|252|253|254|255
type TileCharID = UInt8


/**
 * The 16 color names are:
 * BLACK,  BLUE,  GREEN,  CYAN,  RED,  MAGENTA,  BROWN, LGRAY,
 * DGRAY, LBLUE, LGREEN, LCYAN, LRED, LMAGENTA, YELLOW, WHITE.
 */
const COLOR_SCHEME: UInt8[][] = [
    [0, 0, 0],
    [54, 58, 111],
    [51, 83, 28],
    [26, 113, 115],
    [117, 1, 1],
    [150, 80, 161],
    [116, 84, 54],
    [166, 163, 159],
    [94, 92, 85],
    [83, 103, 176],
    [113, 158, 59],
    [134, 209, 208],
    [227, 47, 27],
    [240, 158, 210],
    [248, 178, 12],
    [255, 255, 255],
]

/**
 * Cache of the RGB style strings, for the 16 colors.
 */
const COLOR_SCHEME_STR = COLOR_SCHEME.map(
    rgb => '#' + rgb.map(n => n.toString(16).padStart(2, '0')).join('')
)

/** Cache of colored atlases, for all 16 colors. */
let coloredAtlases: HTMLCanvasElement[]
/** Length of tileset squares */
let pxPerAtlasTileW: number
let pxPerAtlasTileH: number

/** Initialize colored atlases after load */
const initializeAtlases = () => {
    /** Tileset image from DF. */
    const tileAtlas = document.getElementById('tileset') as HTMLImageElement
    pxPerAtlasTileW = tileAtlas.naturalWidth / 16
    pxPerAtlasTileH = tileAtlas.naturalHeight / 16

    coloredAtlases = COLOR_SCHEME_STR.map((rgbstr, i) => {
        const newAtlas = document.createElement('canvas')
        newAtlas.width = tileAtlas.width
        newAtlas.height = tileAtlas.height
        {
            const newContext = newAtlas.getContext('2d')
            if (newContext == null) throw new Error('CanvasRenderingContext2D unavailable: ' + newAtlas)
            newContext.drawImage(tileAtlas, 0, 0)
            newContext.globalCompositeOperation = 'source-in'
            newContext.fillStyle = rgbstr
            newContext.fillRect(0, 0, newAtlas.width, newAtlas.height)
        }
        return newAtlas
    })
}

const canvas = <HTMLCanvasElement> document.getElementById('canvas')

const pSize: number = 15
let viewWidth: number = 1 // dummy value, before resizeView() is called
let viewHeight: number = 1 // dummy value, before resizeView() is called
let viewMinX: number = 80
let viewMinY: number = 80
let viewZ: number = 158
/** Update canvas dimensions after any resize. Should be followed by a repaint. */
const resizeView = () => {
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    viewWidth = Math.floor(canvas.width / pSize)
    viewHeight = Math.floor(canvas.height / pSize)
}

const cursor = {'x': 0, 'y': 0}

let df: DwarfClient
let creatureRaws: Array<any>
let tiletypeList: Array<any>
let matList: Array<any>
type Block = {
    tile: [TileCharID, ColorID, ColorID] | null,
    tileID: number | null,
    water: UInt3,
    magma: UInt3,
    building?: number,
    vein?: number,
    item?: [TileCharID, ColorID, ColorID]
    itemData?: any,
    unit: {unit: any[], char: any[]},
}
let blockMap: Block[][][] = []

// const rgbToHex = (rgb : Array<number>) => {
//     const r: String = rgb[0].toString(16).padStart(2, '0')
//     const g: String = rgb[1].toString(16).padStart(2, '0')
//     const b: String = rgb[2].toString(16).padStart(2, '0')
//     return '#' + r + g + b
// }

const posIsInView = (posX: number, posY: number, posZ: number): boolean => {
    return (
        posZ === viewZ && posX >= viewMinX && posX < viewMinX + viewWidth
            && posY >= viewMinY && posY < viewMinY + viewHeight
    )
}

const getRelativeCoords = (index: number): {x: number, y: number, z: number} => {
    return {x: index % 16, y: Math.floor(index / 16), z: 0}
}

// HACK
const getColorIdFromProfessionID = (prfID: number): ColorID => {
    return prfID % 16 as ColorID
}

type BlockReq = {
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
}

/** HACK fix block request range, to avoid blank border issue */
const fixBlockRequest = (blkReq: BlockReq): BlockReq => {
    const correct: Map<number, number> = new Map([[4, 7], [3, 7], [2, 5], [1, 5], [0, 3]])
    const newX = correct.get(blkReq.minY) ?? blkReq.minX
    const newY = correct.get(blkReq.minX) ?? blkReq.minY
    const newMinX = (blkReq.minY <= 4 && blkReq.minX > newX) ? newX : blkReq.minX
    const newMinY = (blkReq.minX <= 4 && blkReq.minY > newY) ? newY : blkReq.minY
    blkReq.minX = newMinX
    blkReq.minY = newMinY
    return blkReq
}

/** Update {@link mapBlock} with values from IO */
const updateBlockMap = (blockList: any, unitList: any, creatureRaws: any) => {
    if (blockList.mapBlocks != undefined) {
        for (const mapBlock of blockList.mapBlocks) {
            if (mapBlock.tiles != undefined) {
                mapBlock.tiles.forEach((tileID: number, i: number) => {
                    const relCoords = getRelativeCoords(i)
                    const coords = {
                        x: mapBlock.mapX + relCoords.x,
                        y: mapBlock.mapY + relCoords.y,
                        z: mapBlock.mapZ + relCoords.z
                    }
                    if (blockMap[coords.z] == undefined) {
                        blockMap[coords.z] = []
                    }
                    if (blockMap[coords.z][coords.y] == undefined) {
                        blockMap[coords.z][coords.y] = []
                    }
                    const isHidden = mapBlock.hidden[i]
                    // FIXME check if ID in tiles list
                    blockMap[coords.z][coords.y][coords.x] = {
                        tile: tiles[isHidden ? 0 : tileID],
                        tileID: isHidden ? null : tileID,
                        water: mapBlock.water[i] || 0,
                        magma: mapBlock.magma[i] || 0,
                        unit: { unit: [], char: [] },
                    }
                })
                if (mapBlock.items != undefined) {
                    mapBlock.items.forEach((item: any, i: number) => {
                        const tileCharID = getItemChar(item.type.matType)
                        // FIXME overwrites lower items
                        blockMap[item.pos.z][item.pos.y][item.pos.x].item = [tileCharID, 15, 0]
                        blockMap[item.pos.z][item.pos.y][item.pos.x].itemData = item
                    })
                }
            }
        }
        // adds unit/char to all visible blocks
        blockMap[viewZ].slice(viewMinY, viewMinY + viewHeight).forEach((row, i) => {
            row.slice(viewMinX, viewMinX + viewWidth).forEach((tile, j) => {
                tile.unit = { unit: [], char: [] }
            })
        })
        for (const unit of unitList) {
            if (posIsInView(unit.posX, unit.posY, unit.posZ)) {
                const block = blockMap[unit.posZ][unit.posY][unit.posX]
                if (block.unit != undefined) {  // FIXME ensure this is defined
                    block.unit.unit.push(unit)
                    block.unit.char.push([
                        creatureRaws[unit.race.matType].creatureTile,
                        getColorIdFromProfessionID(unit.professionId),
                        0
                    ])
                } else {
                    console.error(`Unit at missing block ${[unit.posX, unit.posY, unit.posZ]}`)
                }
            }
        }
    }
}

/**
 * Color background of a tile.
 */
const writeBgTile = (
    context: CanvasRenderingContext2D, xi: number, yi: number, bgc: ColorID
) => {
    context.fillStyle = COLOR_SCHEME_STR[bgc]
    context.fillRect(pSize * xi, pSize * yi, pSize, pSize)
}
/**
 * Stamp a colored tile from the tileset.
 */
const writeTile = (
    context: CanvasRenderingContext2D,
    tileCharID: TileCharID, xi: number, yi: number, fgc: ColorID
) => {
    context.drawImage(
        coloredAtlases[fgc], // image
        pxPerAtlasTileW * (tileCharID % 16), // source x
        pxPerAtlasTileH * Math.floor(tileCharID / 16), // source y
        pxPerAtlasTileW, // source width
        pxPerAtlasTileH, // source height

        pSize * xi, // target x
        pSize * yi, // target y
        pSize, // target width
        pSize // target height
    )
}

const paintTiles = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    // render all tiles in view
    blockMap[viewZ].slice(viewMinY, viewMinY + viewHeight).forEach((row, i) => {
        row.slice(viewMinX, viewMinX + viewWidth).forEach((tile, j) => {
            let charDrawn: number
            let backgroundDrawn: number

            // pick which char to draw (from unit, from item, etc) (only one)
            if (tile.unit.unit.length !== 0) charDrawn = 0
            else if (tile.item !== undefined) charDrawn = 1
            else if (tile.building !== undefined) charDrawn = 2
            else if (tile.water !== 0) charDrawn = 3
            else if (tile.magma !== 0) charDrawn = 4
            else if (tile.vein !== undefined) charDrawn = 5
            else if (tile.tile != null) charDrawn = 6
            else charDrawn = 7

            // pick which background to draw
            if (tile.unit.unit.length !== 0) backgroundDrawn = 0
            else if (tile.building !== undefined) backgroundDrawn = 2
            else if (tile.water !== 0) backgroundDrawn = 3
            else if (tile.magma !== 0) backgroundDrawn = 4
            else if (tile.vein !== undefined) backgroundDrawn = 5
            else if (tile.tile != null) backgroundDrawn = 6
            else backgroundDrawn = 7

            switch (backgroundDrawn) {
                case 0: {
                    const bgc = tile.unit.char[0][2]
                    writeBgTile(ctx, j, i, bgc)
                    break
                }
                case 2:
                    break
                case 3: {
                    const bgc = 0
                    writeBgTile(ctx, j, i, bgc)
                    break
                }
                case 4: {
                    const bgc = 0
                    writeBgTile(ctx, j, i, bgc)
                    break
                }
                case 5: {
                    break
                }
                case 6: {
                    const bgc = tile.tile[2]
                    writeBgTile(ctx, j, i, bgc)
                    break
                }
                default:
                    break
            }

            switch (charDrawn) {
                case 0: {
                    writeTile(ctx, tile.unit.char[0][0], j, i, tile.unit.char[0][1])
                    break
                }
                case 1: {
                    writeTile(ctx, tile.item[0], j, i, tile.item[1])
                    break
                }
                case 2:
                    break
                case 3: {
                    writeTile(ctx, (48 + tile.water) as TileCharID, j, i, 1)
                    break
                }
                case 4: {
                    writeTile(ctx, (48 + tile.magma) as TileCharID, j, i, 5)
                    break
                }
                case 5: {
                    break
                }
                case 6: {
                    writeTile(ctx, tile.tile[0], j, i, tile.tile[1])
                    break
                }
                default:
                    break
            }
        })
    })
}

/** Poll tiles in viewport, update cache, repaint */
const updateCanvas = async (df : DwarfClient, ctx: CanvasRenderingContext2D) => {
    const blockRequest: BlockReq = fixBlockRequest({
        'minX': Math.max(Math.floor(viewMinX / 16), 0),
        'minY': Math.max(Math.floor(viewMinY / 16), 0),
        'minZ': viewZ,
        'maxX': Math.max(Math.ceil((viewMinX + viewWidth) / 16), 12),
        'maxY': Math.max(Math.ceil((viewMinY + viewHeight) / 16), 12),
        'maxZ': viewZ + 1
    })
    const blockList = await df.GetBlockList(blockRequest)
    const unitList: Array<any> = (await df.GetUnitList()).creatureList
    updateBlockMap(blockList, unitList, creatureRaws)
    paintTiles(ctx)
}

async function useClient (df: DwarfClient, ctx: CanvasRenderingContext2D) {
    try {
        await df.ready()
        console.log('new DwarfClient:', df)
        await df.ResetMapHashes()
        let blockList = await df.GetBlockList(
            {'minX': 1, 'minY': 1, 'minZ': 150, 'maxX': 9, 'maxY': 9, 'maxZ': 160}
        )
        tiletypeList = (await df.GetTiletypeList()).tiletypeList
        matList = (await df.GetMaterialList()).materialList
        const unitList = (await df.GetUnitList()).creatureList
        creatureRaws =  (await df.GetCreatureRaws()).creatureRaws

        updateBlockMap(blockList, unitList, creatureRaws)

        paintTiles(ctx)
        console.log(blockMap)
    } catch (e) {
        console.error('DwarfClient error:', e)
    } finally {
        console.log('finally')
        // df.destroy()
        // console.log('destroyed')
    }
}

const updateCaption = (caption: HTMLDivElement) => {
    caption.textContent = 'x: ' + (viewMinX + cursor.x) + ' y: ' + (viewMinY + cursor.y)
    if (blockMap[viewZ] !== undefined && blockMap[viewZ][(viewMinY + cursor.y)] !== undefined) {
        const block = blockMap[viewZ][(viewMinY + cursor.y)][(viewMinX + cursor.x)]
        if (block !== undefined) {
            const tileID = block.tileID
            const itemData = block.itemData
            const units = block.unit
            if (tileID != null) caption.textContent += ', ' +  tiletypeList[tileID].caption
            if (itemData != undefined) {
                const mat = itemData.material
                caption.textContent += ', ' + matList.filter(e =>
                    e.matPair.matType === mat.matType && e.matPair.matIndex === mat.matIndex)[0].name
            }
            if (units != undefined && units.unit.length !== 0) {
                for (const unit of units.unit) {
                    if (unit.name !== undefined) {
                        caption.textContent += ', ' + unit.name
                        caption.textContent += ' (' + creatureRaws[unit.race.matType].name[0] + ')'
                    } else {
                        caption.textContent += ', ' + creatureRaws[unit.race.matType].name[0]
                    }
                }
            }
        }
    }
}

const bindKVMControls = (
    canvas: HTMLCanvasElement,
    caption: HTMLDivElement,
    refreshView: () => void,
    repaintView: () => void,
) => {
    canvas.addEventListener('keydown', e => {
        const key : String = e.key
        if (key === '<') {
            viewZ++
            refreshView()
        } else if (key === '>') {
            viewZ--
            refreshView()
        } else if (key === 'ArrowUp') {
            if (viewMinY >= 16) {
                viewMinY -= 16
            } else {
                viewMinY -= viewMinY
            }
            refreshView()
        } else if (key === 'ArrowDown') {
            if (viewMinY + viewHeight <= 176) {
                viewMinY += 16
            } else {
                viewMinY += 192 - (viewMinY + viewHeight)
            }
            refreshView()
        } else if (key === 'ArrowLeft') {
            if (viewMinX >= 16) {
                viewMinX -= 16
            } else {
                viewMinX -= viewMinX
            }
            refreshView()
        } else if (key === 'ArrowRight') {
            if (viewMinX + viewWidth <= 176) {
                viewMinX += 16
            } else {
                viewMinX += 192 - (viewMinX + viewWidth)
            }
            refreshView()
        } else if (key === ' ') {
            refreshView()
        }
        updateCaption(caption)
    })

    canvas.addEventListener('mousemove', e => {
        cursor.x = Math.floor(e.offsetX / pSize)
        cursor.y = Math.floor(e.offsetY / pSize)
        updateCaption(caption)
    })

    window.addEventListener('resize', e => {
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width
        canvas.height = rect.height
        viewWidth = Math.floor(canvas.width / pSize)
        viewHeight = Math.floor(canvas.height / pSize)
        repaintView()  // FIXME refresh if too big?
    })
}


/**
 * Connect to Dwarf Fortress, load files and game data, and run the GUI.
 */
async function main () {
    df = new DwarfClient()
    /* @ts-ignore FIXME Debugging assignments */
    window['df'] = df
    initializeAtlases()
    resizeView()

    const ctx = canvas.getContext('2d')

    // configure controls
    if (ctx == null) throw new Error('CanvasRenderingContext2D unavailable: ' + canvas)
    {
        const caption = document.getElementById('caption') as HTMLDivElement
        bindKVMControls(canvas, caption, () => updateCanvas(df, ctx), () => paintTiles(ctx))
    }
    canvas.focus()

    await useClient(df, ctx)
}

/* @ts-ignore FIXME Debugging assignments */
window['main'] = main

document.readyState == 'complete' ? main() : window.addEventListener('load', main)

function getItemChar (itemTypeID: number): TileCharID {
    switch (itemTypeID) {
        case 3:
            return 15 // ☼
            break
        case 4:
            return 7 // •
            break
        case 5:
            return 22 // ▬
            break
        case 56:
            return 237 // φ
            break
        case 57:
            return 11 // ♂
            break
        default:
            return 63 // ?
            break
    }
}

function getTiles (): ([TileCharID, ColorID, ColorID] | null)[] {
    return [
        [255, 0, 0],
        [31, 15, 0],
        [247, 6, 0],
        [30, 6, 0],
        [60, 13, 5],
        [62, 13, 5],
        [88, 13, 5],
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [240, 6, 0],
        null,
        null,
        null,
        null,
        null,
        [88, 11, 0],
        [62, 11, 0],
        [60, 11, 0],
        null,
        null,
        null,
        null,
        [255, 0, 0],
        null,
        [34, 2, 0],
        [35, 8, 0],
        [88, 8, 0],
        [62, 8, 0],
        [60, 8, 0],
        [88, 4, 0],
        [62, 4, 0],
        [60, 4, 0],
        [42, 12, 0],
        [43, 7, 0],
        [43, 8, 0],
        [43, 13, 0],
        [43, 3, 0],
        [43, 11, 0],
        null,
        [88, 10, 0],
        [62, 10, 0],
        [60, 10, 0],
        [88, 2, 0],
        [62, 2, 0],
        [60, 2, 0],
        [88, 7, 0],
        [62, 7, 0],
        [60, 7, 0],
        [88, 3, 0],
        [62, 3, 0],
        [60, 3, 0],
        [88, 13, 0],
        [62, 13, 0],
        [60, 13, 0],
        null,
        [206, 7, 0],
        null,
        [15, 12, 0],
        null,
        null,
        [46, 12, 0],
        [19, 12, 0],
        [172, 12, 0],
        [59, 12, 0],
        [19, 12, 0],
        [30, 12, 0],
        [46, 12, 0],
        null,
        null,
        [79, 7, 0],
        [79, 8, 0],
        [79, 13, 0],
        [79, 3, 0],
        [79, 11, 0],
        null,
        null,
        null,
        null,
        null,
        [247, 6, 0],
        [247, 6, 0],
        [127, 6, 0],
        [172, 6, 0],
        [79, 6, 0],
        [127, 6, 0],
        [205, 2, 0],
        [205, 2, 0],
        [186, 2, 0],
        [186, 2, 0],
        [201, 2, 0],
        [187, 2, 0],
        [200, 2, 0],
        [188, 2, 0],
        [207, 2, 0],
        [209, 2, 0],
        [182, 2, 0],
        [199, 2, 0],
        [179, 2, 0],
        [196, 2, 0],
        [35, 2, 0],
        [35, 6, 0],
        [217, 2, 0],
        [192, 2, 0],
        [191, 2, 0],
        [218, 2, 0],
        [172, 2, 0],
        [59, 2, 0],
        [30, 2, 0],
        [79, 2, 0],
        [205, 2, 0],
        [205, 2, 0],
        [186, 2, 0],
        [186, 2, 0],
        [201, 2, 0],
        [187, 2, 0],
        [200, 2, 0],
        [188, 2, 0],
        [249, 2, 0],
        [249, 2, 0],
        [249, 2, 0],
        [249, 2, 0],
        [127, 6, 0],
        [172, 6, 0],
        [79, 6, 0],
        [127, 6, 0],
        [205, 6, 0],
        [205, 6, 0],
        [186, 6, 0],
        [186, 6, 0],
        [201, 6, 0],
        [187, 6, 0],
        [200, 6, 0],
        [188, 6, 0],
        [207, 6, 0],
        [209, 6, 0],
        [182, 6, 0],
        [199, 6, 0],
        [179, 6, 0],
        [196, 6, 0],
        null,
        null,
        [217, 6, 0],
        [192, 6, 0],
        [191, 6, 0],
        [218, 6, 0],
        [172, 6, 0],
        [59, 6, 0],
        [30, 6, 0],
        [79, 6, 0],
        [205, 6, 0],
        [205, 6, 0],
        [186, 6, 0],
        [186, 6, 0],
        [201, 6, 0],
        [187, 6, 0],
        [200, 6, 0],
        [188, 6, 0],
        [249, 6, 0],
        [249, 6, 0],
        [249, 6, 0],
        [249, 6, 0],
        null,
        [176, 7, 0],
        [177, 7, 0],
        [178, 7, 0],
        [195, 2, 0],
        [180, 2, 0],
        [193, 2, 0],
        [194, 2, 0],
        [197, 2, 0],
        [195, 6, 0],
        [180, 6, 0],
        [193, 6, 0],
        [194, 6, 0],
        [197, 6, 0],
        [204, 2, 0],
        [185, 2, 0],
        [202, 2, 0],
        [203, 2, 0],
        [186, 2, 0],
        [205, 2, 0],
        [206, 2, 0],
        [10, 2, 0],
        [204, 6, 0],
        [185, 6, 0],
        [202, 6, 0],
        [203, 6, 0],
        [186, 6, 0],
        [205, 6, 0],
        [206, 6, 0],
        [10, 6, 0],
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [219, 7, 0],
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [231, 2, 0],
        null,
        [30, 14, 0],
        [30, 6, 0],
        [30, 10, 0],
        [30, 2, 0],
        [30, 7, 0],
        [30, 8, 0],
        [30, 13, 0],
        [30, 3, 0],
        [30, 4, 0],
        [242, 8, 0],
        [243, 8, 0],
        [126, 8, 0],
        [30, 11, 0],
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [178, 11, 0],
        [178, 11, 0],
        [178, 11, 0],
        [126, 4, 0],
        [178, 11, 0],
        [176, 12, 0],
        [247, 4, 0],
        [219, 4, 0],
        [206, 11, 3],
        [197, 11, 3],
        null,
        [214, 8, 0],
        [213, 8, 0],
        [212, 8, 0],
        [211, 8, 0],
        [190, 8, 0],
        [189, 8, 0],
        [184, 8, 0],
        [183, 8, 0],
        [206, 8, 0],
        [204, 8, 0],
        [203, 8, 0],
        [202, 8, 0],
        [185, 8, 0],
        [201, 8, 0],
        [200, 8, 0],
        [188, 8, 0],
        [187, 8, 0],
        [186, 8, 0],
        [205, 8, 0],
        [214, 13, 0],
        [213, 13, 0],
        [212, 13, 0],
        [211, 13, 0],
        [190, 13, 0],
        [189, 13, 0],
        [184, 13, 0],
        [183, 13, 0],
        [206, 13, 0],
        [204, 13, 0],
        [203, 13, 0],
        [202, 13, 0],
        [185, 13, 0],
        [201, 13, 0],
        [200, 13, 0],
        [188, 13, 0],
        [187, 13, 0],
        [186, 13, 0],
        [205, 13, 0],
        [214, 7, 0],
        [213, 7, 0],
        [212, 7, 0],
        [211, 7, 0],
        [190, 7, 0],
        [189, 7, 0],
        [184, 7, 0],
        [183, 7, 0],
        [206, 7, 0],
        [204, 7, 0],
        [203, 7, 0],
        [202, 7, 0],
        [185, 7, 0],
        [201, 7, 0],
        [200, 7, 0],
        [188, 7, 0],
        [187, 7, 0],
        [186, 7, 0],
        [205, 7, 0],
        [206, 8, 0],
        [206, 13, 0],
        [176, 8, 0],
        [177, 8, 0],
        [178, 8, 0],
        [219, 8, 0],
        [176, 13, 0],
        [177, 13, 0],
        [178, 13, 0],
        [219, 13, 0],
        [39, 7, 0],
        [44, 7, 0],
        [96, 7, 0],
        [46, 7, 0],
        [39, 8, 0],
        [44, 8, 0],
        [96, 8, 0],
        [46, 8, 0],
        [39, 13, 0],
        [44, 13, 0],
        [96, 13, 0],
        [46, 13, 0],
        [39, 2, 0],
        [44, 2, 0],
        [96, 2, 0],
        [46, 2, 0],
        [39, 4, 0],
        [44, 4, 0],
        [96, 4, 0],
        [46, 4, 0],
        [39, 4, 0],
        [44, 4, 0],
        [96, 4, 0],
        [46, 4, 0],
        [206, 11, 0],
        [176, 11, 0],
        [177, 11, 0],
        [178, 11, 0],
        [219, 11, 0],
        [247, 1, 0],
        [247, 1, 0],
        [247, 1, 0],
        [247, 1, 0],
        [247, 1, 0],
        [247, 1, 0],
        [247, 1, 0],
        [247, 1, 0],
        [247, 3, 0],
        [247, 3, 0],
        [247, 3, 0],
        [247, 3, 0],
        [247, 3, 0],
        [247, 3, 0],
        [247, 3, 0],
        [247, 3, 0],
        [247, 11, 0],
        null,
        null,
        null,
        null,
        null,
        [39, 14, 0],
        [44, 14, 0],
        [96, 14, 0],
        [46, 14, 0],
        null,
        [231, 8, 0],
        [34, 6, 0],
        [39, 6, 0],
        [44, 6, 0],
        [96, 6, 0],
        [46, 6, 0],
        [39, 10, 0],
        [44, 10, 0],
        [96, 10, 0],
        [46, 10, 0],
        [236, 7, 0],
        [236, 8, 0],
        [236, 13, 0],
        [39, 7, 0],
        [44, 7, 0],
        [96, 7, 0],
        [46, 7, 0],
        [39, 8, 0],
        [44, 8, 0],
        [96, 8, 0],
        [46, 8, 0],
        [39, 13, 0],
        [44, 13, 0],
        [96, 13, 0],
        [46, 13, 0],
        [214, 3, 0],
        [213, 3, 0],
        [212, 3, 0],
        [211, 3, 0],
        [190, 3, 0],
        [189, 3, 0],
        [184, 3, 0],
        [183, 3, 0],
        [206, 3, 0],
        [204, 3, 0],
        [203, 3, 0],
        [202, 3, 0],
        [185, 3, 0],
        [201, 3, 0],
        [200, 3, 0],
        [188, 3, 0],
        [187, 3, 0],
        [186, 3, 0],
        [205, 3, 0],
        [206, 3, 0],
        [176, 3, 0],
        [177, 3, 0],
        [178, 3, 0],
        [219, 3, 0],
        [39, 3, 0],
        [44, 3, 0],
        [96, 3, 0],
        [46, 3, 0],
        [236, 3, 0],
        [39, 3, 0],
        [44, 3, 0],
        [96, 3, 0],
        [46, 3, 0],
        [214, 11, 0],
        [213, 11, 0],
        [212, 11, 0],
        [211, 11, 0],
        [190, 11, 0],
        [189, 11, 0],
        [184, 11, 0],
        [183, 11, 0],
        [206, 11, 0],
        [204, 11, 0],
        [203, 11, 0],
        [202, 11, 0],
        [185, 11, 0],
        [201, 11, 0],
        [200, 11, 0],
        [188, 11, 0],
        [187, 11, 0],
        [186, 11, 0],
        [205, 11, 0],
        [30, 1, 0],
        [30, 1, 0],
        [30, 1, 0],
        [30, 1, 0],
        [30, 1, 0],
        [30, 1, 0],
        [30, 1, 0],
        [30, 1, 0],
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [43, 15, 0],
        [206, 15, 0],
        [79, 15, 0],
        [214, 15, 0],
        [213, 15, 0],
        [212, 15, 0],
        [211, 15, 0],
        [190, 15, 0],
        [189, 15, 0],
        [184, 15, 0],
        [183, 15, 0],
        [206, 15, 0],
        [204, 15, 0],
        [203, 15, 0],
        [202, 15, 0],
        [185, 15, 0],
        [201, 15, 0],
        [200, 15, 0],
        [188, 15, 0],
        [187, 15, 0],
        [186, 15, 0],
        [205, 15, 0],
        [88, 15, 0],
        [62, 15, 0],
        [60, 15, 0],
        [30, 15, 0],
        [208, 0, 7],
        [210, 0, 7],
        [198, 0, 7],
        [181, 0, 7],
        [186, 0, 7],
        [200, 0, 7],
        [188, 0, 7],
        [201, 0, 7],
        [187, 0, 7],
        [205, 0, 7],
        [204, 0, 7],
        [185, 0, 7],
        [202, 0, 7],
        [203, 0, 7],
        [206, 0, 7],
        [208, 0, 7],
        [210, 0, 7],
        [198, 0, 7],
        [181, 0, 7],
        [186, 0, 7],
        [200, 0, 7],
        [188, 0, 7],
        [201, 0, 7],
        [187, 0, 7],
        [205, 0, 7],
        [204, 0, 7],
        [185, 0, 7],
        [202, 0, 7],
        [203, 0, 7],
        [206, 0, 7],
        [208, 0, 5],
        [210, 0, 5],
        [198, 0, 5],
        [181, 0, 5],
        [186, 0, 5],
        [200, 0, 5],
        [188, 0, 5],
        [201, 0, 5],
        [187, 0, 5],
        [205, 0, 5],
        [204, 0, 5],
        [185, 0, 5],
        [202, 0, 5],
        [203, 0, 5],
        [206, 0, 5],
        [208, 0, 3],
        [210, 0, 3],
        [198, 0, 3],
        [181, 0, 3],
        [186, 0, 3],
        [200, 0, 3],
        [188, 0, 3],
        [201, 0, 3],
        [187, 0, 3],
        [205, 0, 3],
        [204, 0, 3],
        [185, 0, 3],
        [202, 0, 3],
        [203, 0, 3],
        [206, 0, 3],
        [208, 8, 3],
        [210, 8, 3],
        [198, 8, 3],
        [181, 8, 3],
        [186, 8, 3],
        [200, 8, 3],
        [188, 8, 3],
        [201, 8, 3],
        [187, 8, 3],
        [205, 8, 3],
        [204, 8, 3],
        [185, 8, 3],
        [202, 8, 3],
        [203, 8, 3],
        [206, 8, 3],
        [208, 8, 7],
        [210, 8, 7],
        [198, 8, 7],
        [181, 8, 7],
        [186, 8, 7],
        [200, 8, 7],
        [188, 8, 7],
        [201, 8, 7],
        [187, 8, 7],
        [205, 8, 7],
        [204, 8, 7],
        [185, 8, 7],
        [202, 8, 7],
        [203, 8, 7],
        [206, 8, 7],
        [208, 0, 7],
        [210, 0, 7],
        [198, 0, 7],
        [181, 0, 7],
        [186, 0, 7],
        [200, 0, 7],
        [188, 0, 7],
        [201, 0, 7],
        [187, 0, 7],
        [205, 0, 7],
        [204, 0, 7],
        [185, 0, 7],
        [202, 0, 7],
        [203, 0, 7],
        [206, 0, 7],
        [208, 0, 7],
        [210, 0, 7],
        [198, 0, 7],
        [181, 0, 7],
        [186, 0, 7],
        [200, 0, 7],
        [188, 0, 7],
        [201, 0, 7],
        [187, 0, 7],
        [205, 0, 7],
        [204, 0, 7],
        [185, 0, 7],
        [202, 0, 7],
        [203, 0, 7],
        [206, 0, 7],
        [208, 0, 5],
        [210, 0, 5],
        [198, 0, 5],
        [181, 0, 5],
        [186, 0, 5],
        [200, 0, 5],
        [188, 0, 5],
        [201, 0, 5],
        [187, 0, 5],
        [205, 0, 5],
        [204, 0, 5],
        [185, 0, 5],
        [202, 0, 5],
        [203, 0, 5],
        [206, 0, 5],
        [208, 0, 3],
        [210, 0, 3],
        [198, 0, 3],
        [181, 0, 3],
        [186, 0, 3],
        [200, 0, 3],
        [188, 0, 3],
        [201, 0, 3],
        [187, 0, 3],
        [205, 0, 3],
        [204, 0, 3],
        [185, 0, 3],
        [202, 0, 3],
        [203, 0, 3],
        [206, 0, 3],
        [208, 8, 3],
        [210, 8, 3],
        [198, 8, 3],
        [181, 8, 3],
        [186, 8, 3],
        [200, 8, 3],
        [188, 8, 3],
        [201, 8, 3],
        [187, 8, 3],
        [205, 8, 3],
        [204, 8, 3],
        [185, 8, 3],
        [202, 8, 3],
        [203, 8, 3],
        [206, 8, 3],
        [208, 8, 7],
        [210, 8, 7],
        [198, 8, 7],
        [181, 8, 7],
        [186, 8, 7],
        [200, 8, 7],
        [188, 8, 7],
        [201, 8, 7],
        [187, 8, 7],
        [205, 8, 7],
        [204, 8, 7],
        [185, 8, 7],
        [202, 8, 7],
        [203, 8, 7],
        [206, 8, 7]
    ]

}
