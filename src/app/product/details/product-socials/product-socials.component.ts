import { Component } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFacebookF, faInstagram, faXTwitter, faPinterestP, faLinkedinIn } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope, faPrint } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-product-socials',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './product-socials.component.html',
  styleUrl: './product-socials.component.scss'
})
export class ProductSocialsComponent {
  faFacebookF = faFacebookF;
  faInstagram = faInstagram;
  faXTwitter = faXTwitter;
  faPinterestP = faPinterestP;
  faLinkedinIn = faLinkedinIn;
  faEnvelope = faEnvelope;
  faPrint = faPrint;
}
