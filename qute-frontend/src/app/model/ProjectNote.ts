/**
 * Modelo para las notas del proyecto
 */
export class ProjectNote {
    id?: string;
    title: string;
    text: string;
    type: string;
    timestamp: Date;

    constructor(
        title: string = '',
        text: string = '',
        type: string = 'QuMu',
        id?: string,
        timestamp?: Date
    ) {
        this.id = id || crypto.randomUUID();
        this.title = title;
        this.text = text;
        this.type = type;
        this.timestamp = timestamp || new Date();
    }

    /**
     * Actualiza el timestamp a la fecha/hora actual
     */
    updateTimestamp(): void {
        this.timestamp = new Date();
    }

    /**
     * Clona la nota
     */
    clone(): ProjectNote {
        return new ProjectNote(
            this.title,
            this.text,
            this.type,
            crypto.randomUUID(), // Nuevo ID para el clon
            new Date()
        );
    }
}
