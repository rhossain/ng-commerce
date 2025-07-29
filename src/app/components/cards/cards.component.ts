import { Component } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCcPaypal, faCcVisa, faCcMastercard, faCcStripe, faCcDiscover } from '@fortawesome/free-brands-svg-icons';

@Component({
  selector: 'app-cards',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './cards.component.html',
  styleUrl: './cards.component.scss'
})
export class CardsComponent {
  faCcPaypal = faCcPaypal;
  faCcVisa = faCcVisa;
  faCcMastercard = faCcMastercard;
  faCcStripe = faCcStripe;
  faCcDiscover = faCcDiscover;
}
