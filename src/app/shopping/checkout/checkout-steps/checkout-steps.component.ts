import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faTruck, 
  faCreditCard, 
  faMapMarkerAlt, 
  faReceipt,
  faCheck 
} from '@fortawesome/free-solid-svg-icons';

interface CheckoutStep {
  id: number;
  title: string;
  description: string;
  icon: any;
}

@Component({
  selector: 'app-checkout-steps',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './checkout-steps.component.html',
  styleUrl: './checkout-steps.component.scss'
})
export class CheckoutStepsComponent {
  @Input() currentStep: number = 1;
  @Input() completedSteps: Set<number> = new Set();
  @Output() stepChanged = new EventEmitter<number>();

  // Icons
  faTruck = faTruck;
  faCreditCard = faCreditCard;
  faMapMarkerAlt = faMapMarkerAlt;
  faReceipt = faReceipt;
  faCheck = faCheck;

  steps: CheckoutStep[] = [
    {
      id: 1,
      title: 'Shipping',
      description: 'Delivery address',
      icon: this.faMapMarkerAlt
    },
    {
      id: 2,
      title: 'Billing',
      description: 'Billing information',
      icon: this.faReceipt
    },
    {
      id: 3,
      title: 'Delivery',
      description: 'Shipping method',
      icon: this.faTruck
    },
    {
      id: 4,
      title: 'Payment',
      description: 'Payment details',
      icon: this.faCreditCard
    }
  ];

  onStepClick(stepId: number): void {
    // Allow clicking on current step, previous steps, or next step if current is completed
    if (stepId <= this.currentStep || this.completedSteps.has(stepId - 1)) {
      this.stepChanged.emit(stepId);
    }
  }

  isStepActive(stepId: number): boolean {
    return this.currentStep === stepId;
  }

  isStepCompleted(stepId: number): boolean {
    return this.completedSteps.has(stepId);
  }

  isStepClickable(stepId: number): boolean {
    return stepId <= this.currentStep || this.completedSteps.has(stepId - 1);
  }

  getStepStatus(stepId: number): 'completed' | 'active' | 'pending' | 'disabled' {
    if (this.isStepCompleted(stepId)) {
      return 'completed';
    } else if (this.isStepActive(stepId)) {
      return 'active';
    } else if (this.isStepClickable(stepId)) {
      return 'pending';
    } else {
      return 'disabled';
    }
  }
}