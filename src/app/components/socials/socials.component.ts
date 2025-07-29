import { Component } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFacebookF, faInstagram, faXTwitter, faYoutube, faLinkedinIn } from '@fortawesome/free-brands-svg-icons';

@Component({
  selector: 'app-socials',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './socials.component.html',
  styleUrl: './socials.component.scss'
})
export class SocialsComponent {
  faFacebookF = faFacebookF;
  faInstagram = faInstagram;
  faXTwitter = faXTwitter;
  faYoutube = faYoutube;
  faLinkedinIn = faLinkedinIn;
}
