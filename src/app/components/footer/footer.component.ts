import { Component, ViewEncapsulation } from '@angular/core';
import { SocialsComponent } from "../socials/socials.component";
import { CardsComponent } from "../cards/cards.component";
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [SocialsComponent, CardsComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class FooterComponent {
  
}
