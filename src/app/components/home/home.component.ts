import { Component } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faHouse } from '@fortawesome/free-solid-svg-icons';
import { ProductSliderComponent } from "../../shared/product-slider/product-slider.component";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FontAwesomeModule, ProductSliderComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export default class HomeComponent {
  faHouse = faHouse;
}
