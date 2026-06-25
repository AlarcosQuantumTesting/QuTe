import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { SideBarComponent } from './side-bar/side-bar.component';
import { ProjectConfigComponent } from './project-config/project-config.component';
import { ConfirmationModalComponent } from './components/confirmation-modal/confirmation-modal.component';
import { TestSuiteComponent } from './test-suite/test-suite.component';
import { SaveButtonComponent } from './save-button/save-button.component';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    SideBarComponent,
    ProjectConfigComponent,
    ConfirmationModalComponent,
    TestSuiteComponent,
    SaveButtonComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
