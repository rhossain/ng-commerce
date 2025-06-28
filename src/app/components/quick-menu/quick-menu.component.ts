import { Component } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBagShopping, faShop, faUser } from '@fortawesome/free-solid-svg-icons';
import { faHeart } from '@fortawesome/free-regular-svg-icons';
import { UnderDevelopmentDirective } from '../../shared/under-development.directive';

@Component({
  selector: 'app-quick-menu',
  standalone: true,
  imports: [FontAwesomeModule, UnderDevelopmentDirective],
  templateUrl: './quick-menu.component.html',
  styleUrl: './quick-menu.component.scss'
})
export class QuickMenuComponent {
  // Icons
  faBagShopping = faBagShopping;
  faHeart = faHeart;
  faShop = faShop;
  faUser = faUser;
}
