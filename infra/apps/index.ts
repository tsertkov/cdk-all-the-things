import { deployerGlb } from './deployer-glb/index.js'
import { monitorGlb } from './monitor-glb/index.js'
import { monitor } from './monitor/index.js'
import { be } from './be/index.js'
import { fe } from './fe/index.js'

export default {
  'deployer-glb': deployerGlb,
  'monitor-glb': monitorGlb,
  monitor,
  be,
  fe,
}
