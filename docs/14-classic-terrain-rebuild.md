# REQ-20261107-14：按星际争霸一真实地形重做

用户再次否定当前地图，要求参考星际争霸一地图的质感和效果。本需求取代需求12中的随机拼片、透明噪声过渡与多边形高台做法。

目标：原版比例的细密像素纹理，草地/土壤清楚而有自然参差的边界，完整连续的真实岩壁/地形，而非虚化绿褐噪声、积木高台或几何碎石。先对照本地Map_Grass原图，再用连贯地形结构构建适合战场的地图。资源只放本地忽略包，缺包回退保留。

范围：战场渲染、素材提取与少量部署标识视觉；双屏地图、敌人路线与32部署点保留。台地仍是装饰。删去旧多边形石块/箱子/高台，不改战斗数值。

验收：左右战场实际截图检查；无黑块/硬方块接缝/高台穿过路线或部署点。部署、平移、机枪兵后坐力回归；typecheck、测试与构建通过。视觉记录明确为已实现待用户审美确认，不能用测试通过代替质感验收。


## 实施方式与素材项目

- 对照原版Jungle地图Map_Grass，取消上一版放大到48px的随机单块、透明噪声混合、几何高台/碎石/箱子。使用原始32px图块，以CV5左右成对变体铺设。
- 采用 scm-js 的独立 ISOM 地形笔刷进行离线布局：草地/土壤使用完整边缘组；北侧和南侧高地使用原版垂直岩壁堆叠，而非把岩石纹理贴进多边形。
- scm-js：https://github.com/scm-js/scm-js （MIT），格式说明：https://docs.scmjs.dev/chk/the-isometric-record-explained/ 。值得继续研究的星际地图编辑器项目。原版图形来源仍是 https://github.com/dada78641/bwmapgfx ，权利归相应权利人，本地忽略包规则不变。
- 离线画布80×20图块，即2560×640；游戏只显示原有战场窗口，无压扁/放大/再次混色。部署标识改为淡色角标，开始部署时高亮，正常状态不再覆盖大型金属圆盘。
- scripts/generate-classic-terrain.mts 负责项目布局，scripts/stage-terrain-pack.py 负责适配离线笔刷并提取/烘焙；运行期只加载一张PNG，不载入编辑器代码或增加计算压力。

## 本地重新生成

本地缓存需要 artifacts/starcraft1/tileset/jungle.{cv5,vx4,vr4,wpe} 和 scm-js 源码的 src 目录，后者位于 artifacts/starcraft1/scm-js。提取脚本在同目录生成 isom-standalone.ts 文档适配层，使用上游笔刷，不包含编辑器UI。tsx需在本机npm缓存中，首次可用 npx --yes --package=tsx tsx scripts/generate-classic-terrain.mts 准备；之后stage脚本使用 --offline，无网络请求。常规入口仍是 python scripts/stage-starcraft-pack.py；仅重做地形可运行 python scripts/stage-terrain-pack.py。若上游源码或工具未准备，明确输出跳过原因，程序化回退仍可启动。

## 验证结果

800个ISOM单元，连接不匹配0；沿敌人路线每8px采样未碰到高地，32个部署点均未处于高地。左右两区截图129、132已检查，草丛/土壤边缘与连续岩壁可辨，无旧多边形贴片。

四兵种制造部署、升级比例、200次1x/5x后坐力、敌人步态暂停、视角平移、缺本地包回退均通过；34项单测、typecheck、build通过。记录artifacts/classic-terrain-verification.json与artifacts/visual-overhaul-verification.json。

状态：实现与功能验证完成，视觉质感待用户确认。测试通过不代表已获用户审美认可。
