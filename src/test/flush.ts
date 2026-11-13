/**
 * 只推进微任务队列，不依赖 setTimeout。
 * 在启用假定时器的用例里，flushPromises 会被卡住，这里作为替代。
 */
export async function flushMicrotasks(rounds = 32): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve()
  }
}
