import { Component, ViewEncapsulation } from '@angular/core';
import { SocialsComponent } from "../socials/socials.component";
import { CardsComponent } from "../cards/cards.component";
import { QuickMenuComponent } from "../quick-menu/quick-menu.component";
import { UnderDevelopmentDirective } from '../../shared/under-development.directive';
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [SocialsComponent, CardsComponent, QuickMenuComponent, UnderDevelopmentDirective],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class FooterComponent {
  
}
