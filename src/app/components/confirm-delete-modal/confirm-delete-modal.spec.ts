import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmDeleteModal } from './confirm-delete-modal';

describe('ConfirmDeleteModal', () => {
  let fixture: ComponentFixture<ConfirmDeleteModal>;
  let component: ConfirmDeleteModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDeleteModal],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDeleteModal);
    fixture.componentRef.setInput('modalId', 'testModal');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits cancelled when the modal is hidden without confirming', async () => {
    const cancelled = vi.fn();

    component.cancelled.subscribe(cancelled);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.modal')?.dispatchEvent(new Event('hidden.bs.modal'));

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('does not emit cancelled after confirm hides the modal', async () => {
    const cancelled = vi.fn();
    const confirmed = vi.fn();

    component.cancelled.subscribe(cancelled);
    component.confirmed.subscribe(confirmed);

    await fixture.whenStable();
    component.onConfirm();
    fixture.nativeElement.querySelector('.modal')?.dispatchEvent(new Event('hidden.bs.modal'));

    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });
});
