import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConverterService {

  constructor(private client: HttpClient) { }

  convert(request: { quirkJson: string; language: string }) {
    return this.client.post<any>(`${environment.api.execution}/api/converter/convert`, request);
  }
}
