import { createFileRoute } from '@tanstack/react-router'
import { CharacterSelector } from '#/components/CharacterSelector'

export const Route = createFileRoute('/')({ component: CharacterSelector })
