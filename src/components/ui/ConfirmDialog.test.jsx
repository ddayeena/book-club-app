import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog.jsx'
import { ServiceError } from '../../services/ServiceError.js'

function Example({ action = async () => {}, danger = true }) {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)}>Відкрити</button>{open && <ConfirmDialog title="Видалити запис?" danger={danger} onCancel={() => setOpen(false)} onConfirm={async () => { await action(); setOpen(false) }}>
    <p>Цю дію неможливо скасувати.</p><input aria-label="Додаткове поле" />
  </ConfirmDialog>}</>
}

test('native modal has accessible name, description and safe initial focus; cancellation restores focus', async () => {
  const action = vi.fn(), modal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
  render(<Example action={action} />)
  const opener = screen.getByRole('button', { name: 'Відкрити' })
  await userEvent.click(opener)
  expect(modal).toHaveBeenCalled()
  expect(screen.getByRole('alertdialog', { name: 'Видалити запис?' })).toHaveAccessibleDescription('Цю дію неможливо скасувати.')
  expect(screen.getByRole('button', { name: 'Скасувати' })).toHaveFocus()
  await userEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(action).not.toHaveBeenCalled()
  expect(opener).toHaveFocus()
  modal.mockRestore()
})

test('Escape closes without confirmation and Enter in a field does not confirm', async () => {
  const action = vi.fn()
  render(<Example action={action} />)
  await userEvent.click(screen.getByRole('button', { name: 'Відкрити' }))
  await userEvent.click(screen.getByLabelText('Додаткове поле'))
  await userEvent.keyboard('{Enter}')
  expect(action).not.toHaveBeenCalled()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Відкрити' })).toHaveFocus()
})

test('pending operation prevents repeated confirmation and Escape until completion', async () => {
  let finish
  const action = vi.fn(() => new Promise(resolve => { finish = resolve }))
  render(<Example action={action} />)
  await userEvent.click(screen.getByRole('button', { name: 'Відкрити' }))
  const button = screen.getByRole('button', { name: 'Підтвердити' })
  fireEvent.click(button); fireEvent.click(button)
  expect(action).toHaveBeenCalledTimes(1)
  expect(button).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  await act(async () => finish())
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('operation failure retains context and supports an explicit retry', async () => {
  const action = vi.fn().mockRejectedValueOnce(new ServiceError('Спробуйте ще раз')).mockResolvedValueOnce(undefined)
  render(<Example action={action} danger={false} />)
  await userEvent.click(screen.getByRole('button', { name: 'Відкрити' }))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Спробуйте ще раз')
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Підтвердити' })).toHaveClass('app-button-primary')
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  expect(action).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
