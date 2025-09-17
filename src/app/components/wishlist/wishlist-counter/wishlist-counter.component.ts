import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faHeart } from '@fortawesome/free-regular-svg-icons';
import { Subscription } from 'rxjs';
import { WishlistService } from '../../../services/wishlist.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-wishlist-counter',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule],
  templateUrl: './wishlist-counter.component.html',
  styleUrl: './wishlist-counter.component.scss'
})
export class WishlistCounterComponent implements OnInit, OnDestroy {
  wishlistCount = 0;
  isAuthenticated = false;
  faHeart = faHeart;
  
  private subscriptions = new Subscription();

  constructor(
    private wishlistService: WishlistService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Subscribe to authentication state
    this.subscriptions.add(
      this.authService.user$.subscribe(user => {
        this.isAuthenticated = !!user;
      })
    );

    // Subscribe to wishlist count changes
    this.subscriptions.add(
      this.wishlistService.wishlistCount$.subscribe(count => {
        this.wishlistCount = count;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}