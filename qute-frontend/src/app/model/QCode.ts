export class QCode {

    id? : number
    code?: string
    platform?: string

    constructor(id?: number, code?: string, platform?: string) {
        this.id = id
        this.code =code
        this.platform = platform
    }

}